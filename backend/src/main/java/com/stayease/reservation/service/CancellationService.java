package com.stayease.reservation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.stayease.reservation.entity.CancellationPolicy;
import com.stayease.reservation.entity.ReservationStatus;
import com.stayease.notification.service.NotificationService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.*;
import java.util.Map;
import java.util.UUID;

@Service
public class CancellationService {
    private final JdbcTemplate jdbc; private final ObjectMapper json; private final NotificationService notifications;
    public CancellationService(JdbcTemplate jdbc,ObjectMapper json,NotificationService notifications){this.jdbc=jdbc;this.json=json;this.notifications=notifications;}
    public record Result(UUID reservationId,String status,String currency,BigDecimal refundAmount){}

    @Transactional
    public Result cancel(UUID guestId,UUID reservationId,String reason) {
        var rows=jdbc.query("SELECT r.status,r.check_in,r.currency,r.total_amount,r.policy_snapshot,h.timezone FROM reservation r JOIN hotel h ON h.id=r.hotel_id WHERE r.id=? AND r.guest_id=? FOR UPDATE OF r",
            (rs,n)->new Object[]{rs.getString(1),rs.getDate(2).toLocalDate(),rs.getString(3).trim(),rs.getBigDecimal(4),rs.getString(5),rs.getString(6)},reservationId,guestId);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Reservation not found");
        Object[] reservation=rows.getFirst();String status=(String)reservation[0];
        try{ReservationStatus.valueOf(status).transitionTo(ReservationStatus.CANCELLED,false);}catch(IllegalStateException|IllegalArgumentException e){throw new ResponseStatusException(HttpStatus.CONFLICT,"This reservation cannot be cancelled in its current state");}
        BigDecimal amount=BigDecimal.ZERO;String snapshot=(String)reservation[4];
        var atHotel=jdbc.query("SELECT status FROM payment WHERE reservation_id=? AND provider='hotel' FOR UPDATE",(rs,n)->rs.getString(1),reservationId);
        var paid=jdbc.query("SELECT id,provider_payment_reference,currency FROM payment WHERE reservation_id=? AND provider='stripe' AND status='SUCCEEDED' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",(rs,n)->new Object[]{rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3).trim()},reservationId);
        if(status.equals("CONFIRMED")&&paid.isEmpty()&&atHotel.contains("SUCCEEDED"))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"You paid for this stay at the hotel, so please contact the hotel to cancel and arrange your refund");
        boolean unpaidAtHotel=status.equals("CONFIRMED")&&paid.isEmpty()&&atHotel.contains("PENDING");
        if(unpaidAtHotel) {
            // Nothing was charged, so nothing is refunded; the desk balance is simply dropped.
            jdbc.update("UPDATE payment SET status='FAILED',updated_at=now() WHERE reservation_id=? AND provider='hotel' AND status='PENDING'",reservationId);
            jdbc.update("INSERT INTO cancellation(reservation_id,policy_snapshot,refund_amount,reason) VALUES(?,?::jsonb,0,?)",reservationId,snapshot==null?"{}":snapshot,reason);
        } else if(status.equals("CONFIRMED")) {
            if(paid.isEmpty())throw new ResponseStatusException(HttpStatus.CONFLICT,"Successful payment record is required to cancel this confirmed reservation");
            int freeHours=0;BigDecimal policyRefund=BigDecimal.ZERO;
            if(snapshot!=null&&!snapshot.isBlank())try{var node=json.readTree(snapshot);freeHours=node.path("freeCancelHours").asInt(0);policyRefund=node.path("refundPercent").decimalValue();}catch(Exception e){throw new IllegalStateException("Stored cancellation policy is invalid",e);}
            ZoneId zone=ZoneId.of((String)reservation[5]);Instant checkIn=((LocalDate)reservation[1]).atStartOfDay(zone).toInstant();long hours=Duration.between(Instant.now(),checkIn).toHours();
            BigDecimal percent=CancellationPolicy.refundPercent(freeHours,policyRefund,hours);
            amount=((BigDecimal)reservation[3]).multiply(percent).divide(new BigDecimal("100"),4,RoundingMode.HALF_UP);
            if(amount.signum()>0) {
                UUID paymentId=(UUID)paid.getFirst()[0];String pi=(String)paid.getFirst()[1];
                // cancellation row is created below; its id lets the durable refund worker attach an outcome.
                UUID cancellation=UUID.randomUUID();String policyJson=snapshot==null?"{}":snapshot;
                jdbc.update("INSERT INTO cancellation(id,reservation_id,policy_snapshot,refund_amount,reason) VALUES(?,?,?::jsonb,?,?)",cancellation,reservationId,policyJson,amount,reason);
                jdbc.update("INSERT INTO payment_reconciliation(payment_id,cancellation_id,action,provider_reference,idempotency_key,refund_amount,refund_currency) VALUES(?,?,'POLICY_REFUND',?,?,?,?)",paymentId,cancellation,pi,"policy-refund-"+cancellation,amount,paid.getFirst()[2]);
            } else {
                jdbc.update("INSERT INTO cancellation(reservation_id,policy_snapshot,refund_amount,reason) VALUES(?,?::jsonb,?,?)",reservationId,snapshot==null?"{}":snapshot,amount,reason);
            }
        } else {
            jdbc.update("INSERT INTO cancellation(reservation_id,policy_snapshot,refund_amount,reason) VALUES(?,?::jsonb,?,?)",reservationId,snapshot==null?"{}":snapshot,amount,reason);
        }
        jdbc.update("UPDATE reservation SET status='CANCELLED',hold_expires_at=NULL,updated_at=now() WHERE id=?",reservationId);
        jdbc.update("UPDATE room_occupancy SET active=false WHERE reservation_room_id IN (SELECT id FROM reservation_room WHERE reservation_id=?)",reservationId);
        jdbc.update("INSERT INTO reservation_status_history(reservation_id,from_status,to_status,actor_user_id,reason) VALUES(?,?,'CANCELLED',?,?)",reservationId,status,guestId,reason==null?"Guest cancellation":reason);
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id,details) SELECT ?,hotel_id,'RESERVATION_CANCELLED','Reservation',id,jsonb_build_object('refundAmount',?,'currency',?) FROM reservation WHERE id=?",guestId,amount,reservation[2],reservationId);
        notifications.enqueueReservationEvent(reservationId,"RESERVATION_CANCELLED");
        return new Result(reservationId,"CANCELLED",(String)reservation[2],amount);
    }
}

