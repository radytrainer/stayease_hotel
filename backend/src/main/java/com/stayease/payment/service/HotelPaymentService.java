package com.stayease.payment.service;

import com.stayease.notification.service.NotificationService;
import com.stayease.reservation.entity.ReservationStatus;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * "Pay at hotel": the guest confirms a held booking without paying online and settles at the front desk.
 * The booking is a payment row with provider 'hotel' that stays PENDING until reception or the manager records
 * the money, so it only counts as revenue once it has actually been received.
 */
@Service
public class HotelPaymentService {
    public static final String PROVIDER = "hotel";
    private final JdbcTemplate jdbc; private final NotificationService notifications;
    public HotelPaymentService(JdbcTemplate jdbc,NotificationService notifications){this.jdbc=jdbc;this.notifications=notifications;}
    public record Choice(UUID reservationId,String status,String paymentMethod,BigDecimal amountDue,String currency){}

    @Transactional
    public Choice payAtHotel(UUID guestId,UUID reservationId) {
        var rows=jdbc.query("SELECT status,hold_expires_at,total_amount,currency FROM reservation WHERE id=? AND guest_id=? FOR UPDATE",
            (rs,n)->new Object[]{rs.getString(1),rs.getObject(2,OffsetDateTime.class),rs.getBigDecimal(3),rs.getString(4).trim()},reservationId,guestId);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Reservation not found");
        Object[] r=rows.getFirst();String status=(String)r[0];
        boolean alreadyChosen=jdbc.queryForObject("SELECT count(*) FROM payment WHERE reservation_id=? AND provider=?",Integer.class,reservationId,PROVIDER)>0;
        if(alreadyChosen&&"CONFIRMED".equals(status))return new Choice(reservationId,status,"HOTEL",(BigDecimal)r[2],(String)r[3]);
        if(!"PENDING_PAYMENT".equals(status)||r[1]==null||!((OffsetDateTime)r[1]).isAfter(OffsetDateTime.now()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"Your room hold has ended. Search again to book these dates.");
        ReservationStatus.valueOf(status).confirmForPaymentAtHotel();
        jdbc.update("INSERT INTO payment(reservation_id,provider,idempotency_key,amount,currency,status) VALUES(?,?,?,?,?,'PENDING')",reservationId,PROVIDER,"pay-at-hotel-"+reservationId,r[2],r[3]);
        jdbc.update("UPDATE reservation SET status='CONFIRMED',hold_expires_at=NULL,updated_at=now() WHERE id=?",reservationId);
        jdbc.update("INSERT INTO reservation_status_history(reservation_id,from_status,to_status,actor_user_id,reason) VALUES(?,'PENDING_PAYMENT','CONFIRMED',?,'Guest chose to pay at the hotel')",reservationId,guestId);
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id) SELECT ?,hotel_id,'PAY_AT_HOTEL_CHOSEN','Reservation',id FROM reservation WHERE id=?",guestId,reservationId);
        notifications.enqueueReservationEvent(reservationId,"RESERVATION_CONFIRMED",Map.of("paymentMethod","HOTEL","amountDue",r[2]));
        return new Choice(reservationId,"CONFIRMED","HOTEL",(BigDecimal)r[2],(String)r[3]);
    }

    /** Front desk or manager records the money. Callers check the staff member is assigned to {@code hotelId}. */
    @Transactional
    public Map<String,Object> markReceived(UUID hotelId,UUID reservationId,UUID staffUserId) {
        var payments=jdbc.query("SELECT p.id,p.status,r.status FROM payment p JOIN reservation r ON r.id=p.reservation_id WHERE p.reservation_id=? AND r.hotel_id=? AND p.provider=? FOR UPDATE OF p",
            (rs,n)->new Object[]{rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3)},reservationId,hotelId,PROVIDER);
        if(payments.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"No pay-at-hotel balance for this reservation");
        Object[] p=payments.getFirst();UUID paymentId=(UUID)p[0];
        if("SUCCEEDED".equals(p[1]))return Map.of("reservationId",reservationId,"paymentStatus","SUCCEEDED");
        if(!"PENDING".equals(p[1]))throw new ResponseStatusException(HttpStatus.CONFLICT,"Nothing is due at the hotel for this reservation");
        if(!List.of("CONFIRMED","CHECKED_IN","CHECKED_OUT","COMPLETED").contains((String)p[2]))throw new ResponseStatusException(HttpStatus.CONFLICT,"Only active or completed stays can be marked as paid");
        jdbc.update("UPDATE payment SET status='SUCCEEDED',updated_at=now() WHERE id=?",paymentId);
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id,details) VALUES(?,?,'HOTEL_PAYMENT_RECEIVED','Payment',?,jsonb_build_object('reservationId',?::text))",staffUserId,hotelId,paymentId,reservationId.toString());
        return Map.of("reservationId",reservationId,"paymentStatus","SUCCEEDED");
    }

    /** Pay-at-hotel balances still to collect, soonest arrival first. */
    @Transactional(readOnly=true)
    public List<Map<String,Object>> outstanding(UUID hotelId) {
        return jdbc.queryForList("SELECT r.id,r.status,r.check_in,r.check_out,p.amount,p.currency,u.full_name AS guest_name,u.email FROM payment p JOIN reservation r ON r.id=p.reservation_id JOIN app_user u ON u.id=r.guest_id WHERE r.hotel_id=? AND p.provider=? AND p.status='PENDING' AND r.status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT','COMPLETED') ORDER BY r.check_in,u.full_name LIMIT 200",hotelId,PROVIDER);
    }

    /** A booking that was later paid online, or cancelled before arrival, no longer owes anything at the desk. */
    public void voidOutstanding(UUID reservationId) {
        jdbc.update("UPDATE payment SET status='FAILED',updated_at=now() WHERE reservation_id=? AND provider=? AND status='PENDING'",reservationId,PROVIDER);
    }
}
