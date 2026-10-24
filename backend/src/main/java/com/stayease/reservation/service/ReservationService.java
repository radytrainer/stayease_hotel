package com.stayease.reservation.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.stayease.notification.service.NotificationService;
import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.dto.ReservationResponse;
import com.stayease.promotion.service.PromotionService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class ReservationService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper json;
    private final NotificationService notifications;
    private final PromotionService promotions;
    public ReservationService(JdbcTemplate jdbc, ObjectMapper json, NotificationService notifications, PromotionService promotions) { this.jdbc=jdbc; this.json=json; this.notifications=notifications; this.promotions=promotions; }

    private record RoomQuote(UUID id, String name, String currency, int capacity, List<Map<String,Object>> nights, BigDecimal total) {}
    private record RoomInfo(String name, BigDecimal base, String currency, int capacity) {}

    @Transactional
    public ReservationResponse create(UUID guestId, ReservationCreateRequest req) {
        if (guestId == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!req.checkOut().isAfter(req.checkIn())) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Check-out must be after check-in");
        if (req.checkIn().isBefore(LocalDate.now(java.time.ZoneOffset.UTC))) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Check-in cannot be in the past");
        if (req.guests()<1 || req.guests()>20) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Guests must be between 1 and 20");
        long nights=java.time.temporal.ChronoUnit.DAYS.between(req.checkIn(),req.checkOut());
        if (nights>60) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"A stay cannot exceed 60 nights");
        List<UUID> unique=req.roomIds().stream().distinct().sorted().toList();
        if (unique.size()!=req.roomIds().size() || unique.size()>8) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose between 1 and 8 distinct rooms");

        // Serialize retries of one request so a concurrent duplicate waits for the first, then replays its result.
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?,0))",rs->null,guestId+":"+req.idempotencyKey());
        var prior=jdbc.query("SELECT id,status,check_in,check_out,currency,total_amount,hold_expires_at FROM reservation WHERE guest_id=? AND idempotency_key=?",
            (rs,n)->new ReservationResponse(rs.getObject("id",UUID.class),rs.getString("status"),rs.getDate("check_in").toLocalDate(),rs.getDate("check_out").toLocalDate(),rs.getString("currency").trim(),rs.getBigDecimal("total_amount"),rs.getObject("hold_expires_at",OffsetDateTime.class)),guestId,req.idempotencyKey());
        if (!prior.isEmpty()) return prior.getFirst();

        Integer approved=jdbc.queryForObject("SELECT count(*) FROM hotel WHERE id=? AND status='APPROVED'",Integer.class,req.hotelId());
        if (approved==null || approved==0) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Hotel not found");
        List<RoomQuote> quotes=new ArrayList<>();
        for (UUID roomId:unique) {
            var rooms=jdbc.query("SELECT rt.name,rt.base_price,rt.currency,rt.capacity FROM room r JOIN room_type rt ON rt.id=r.room_type_id WHERE r.id=? AND r.hotel_id=? AND r.operational_status='AVAILABLE' AND rt.active FOR UPDATE OF r",
                (rs,n)->new RoomInfo(rs.getString(1),rs.getBigDecimal(2),rs.getString(3).trim(),rs.getInt(4)),roomId,req.hotelId());
            if (rooms.isEmpty()) throw new ResponseStatusException(HttpStatus.CONFLICT,"Selected room is unavailable");
            RoomInfo info=rooms.getFirst();
            BigDecimal total=BigDecimal.ZERO; List<Map<String,Object>> rates=new ArrayList<>();
            for(LocalDate date=req.checkIn();date.isBefore(req.checkOut());date=date.plusDays(1)) {
                var rules=jdbc.query("SELECT nightly_price,currency FROM pricing_rule WHERE room_type_id=(SELECT room_type_id FROM room WHERE id=?) AND starts_on<=? AND ends_on>? ORDER BY priority DESC,starts_on DESC LIMIT 1",
                    (rs,n)->new Object[]{rs.getBigDecimal(1),rs.getString(2).trim()},roomId,date,date);
                BigDecimal price=info.base(); String currency=info.currency();
                if(!rules.isEmpty()){price=(BigDecimal)rules.getFirst()[0];currency=(String)rules.getFirst()[1];}
                if(!info.currency().equals(currency)) throw new ResponseStatusException(HttpStatus.CONFLICT,"Pricing currency configuration is inconsistent");
                rates.add(Map.of("date",date.toString(),"amount",price)); total=total.add(price);
            }
            quotes.add(new RoomQuote(roomId,info.name(),info.currency(),info.capacity(),rates,total));
        }
        if(quotes.stream().mapToInt(RoomQuote::capacity).sum()<req.guests())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Selected rooms do not have enough guest capacity");
        String currency=quotes.getFirst().currency();
        if(quotes.stream().anyMatch(q->!q.currency().equals(currency))) throw new ResponseStatusException(HttpStatus.CONFLICT,"Selected rooms use different currencies");
        BigDecimal subtotal=quotes.stream().map(RoomQuote::total).reduce(BigDecimal.ZERO,BigDecimal::add);
        PromotionService.Applied promo=req.promoCode()==null||req.promoCode().isBlank()?null
            :promotions.applyForBooking(req.hotelId(),req.promoCode(),req.checkIn(),req.checkOut(),guestId,subtotal,currency);
        BigDecimal discount=promo==null?BigDecimal.ZERO:promo.discount();
        BigDecimal total=subtotal.subtract(discount);
        UUID reservation=UUID.randomUUID(); OffsetDateTime hold=OffsetDateTime.now().plusMinutes(15);
        var policies=jdbc.query("SELECT id,free_cancel_hours,refund_percent FROM cancellation_policy WHERE hotel_id=? AND active ORDER BY id LIMIT 1",(rs,n)->new Object[]{rs.getObject(1,UUID.class),rs.getInt(2),rs.getBigDecimal(3)},req.hotelId());
        UUID policy=policies.isEmpty()?null:(UUID)policies.getFirst()[0];String snapshot=null;
        if(!policies.isEmpty())try{snapshot=json.writeValueAsString(Map.of("freeCancelHours",policies.getFirst()[1],"refundPercent",policies.getFirst()[2]));}catch(JsonProcessingException e){throw new IllegalStateException("Could not snapshot cancellation policy",e);}
        jdbc.update("INSERT INTO reservation(id,guest_id,hotel_id,policy_id,policy_snapshot,check_in,check_out,guest_count,status,currency,total_amount,idempotency_key,hold_expires_at,subtotal_amount,discount_amount,promotion_code_id) VALUES(?,?,?, ?,?::jsonb,?,?,?, 'PENDING_PAYMENT',?,?,?,?,?,?,?)",
            reservation,guestId,req.hotelId(),policy,snapshot,req.checkIn(),req.checkOut(),req.guests(),currency,total,req.idempotencyKey(),hold,subtotal,discount,promo==null?null:promo.promotion().id());
        jdbc.update("INSERT INTO reservation_status_history(reservation_id,to_status,actor_user_id,reason) VALUES(?,'PENDING_PAYMENT',?,'Inventory hold created')",reservation,guestId);
        for(RoomQuote quote:quotes) {
            String rateJson;
            try { rateJson=json.writeValueAsString(quote.nights()); }
            catch(JsonProcessingException e){throw new IllegalStateException("Could not snapshot nightly pricing",e);}
            UUID line=UUID.randomUUID();
            jdbc.update("INSERT INTO reservation_room(id,reservation_id,room_id,room_type_name,nightly_rates,line_total,currency) VALUES(?,?,?,?,?::jsonb,?,?)",line,reservation,quote.id(),quote.name(),rateJson,quote.total(),currency);
            jdbc.update("INSERT INTO room_occupancy(reservation_room_id,room_id,stay) VALUES(?,?,daterange(?,?,'[)'))",line,quote.id(),req.checkIn(),req.checkOut());
        }
        notifications.enqueueReservationEvent(reservation,"RESERVATION_HOLD_CREATED");
        return new ReservationResponse(reservation,"PENDING_PAYMENT",req.checkIn(),req.checkOut(),currency,total,hold);
    }

    public List<Map<String,Object>> history(UUID guestId) {
        return jdbc.query("SELECT r.id,r.status,r.check_in,r.check_out,r.currency,r.total_amount,r.created_at,h.name AS hotel_name,"+HOTEL_PAYMENT+" FROM reservation r JOIN hotel h ON h.id=r.hotel_id WHERE r.guest_id=? ORDER BY r.created_at DESC LIMIT 100",
            (rs,n)->Map.<String,Object>of("id",rs.getObject("id"),"status",rs.getString("status"),"checkIn",rs.getDate("check_in").toLocalDate(),"checkOut",rs.getDate("check_out").toLocalDate(),"currency",rs.getString("currency").trim(),"total",rs.getBigDecimal("total_amount"),"createdAt",rs.getObject("created_at"),"hotelName",rs.getString("hotel_name"),"hotelPayment",rs.getString("hotel_payment")),guestId);
    }

    /** Status of the pay-at-hotel balance (PENDING = still to pay at the desk), or '' when the guest didn't choose it. */
    private static final String HOTEL_PAYMENT="COALESCE((SELECT p.status FROM payment p WHERE p.reservation_id=r.id AND p.provider='hotel'),'') AS hotel_payment";

    public ReservationResponse details(UUID guestId,UUID reservationId){
        var rows=jdbc.query("SELECT id,status,check_in,check_out,currency,total_amount,hold_expires_at FROM reservation WHERE id=? AND guest_id=?",
            (rs,n)->new ReservationResponse(rs.getObject("id",UUID.class),rs.getString("status"),rs.getDate("check_in").toLocalDate(),rs.getDate("check_out").toLocalDate(),rs.getString("currency").trim(),rs.getBigDecimal("total_amount"),rs.getObject("hold_expires_at",OffsetDateTime.class)),reservationId,guestId);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Reservation not found");
        return rows.getFirst();
    }

    public Map<String,Object> summary(UUID guestId,UUID reservationId){
        var rows=jdbc.query("SELECT r.id,r.status,r.check_in,r.check_out,r.guest_count,r.currency,r.total_amount,r.hold_expires_at,r.created_at,r.subtotal_amount,r.discount_amount,(SELECT p.code FROM promotion_code p WHERE p.id=r.promotion_code_id) AS promo_code,h.name AS hotel_name,h.address,h.city,h.country,"+HOTEL_PAYMENT+" FROM reservation r JOIN hotel h ON h.id=r.hotel_id WHERE r.id=? AND r.guest_id=?",
            (rs,n)->{var result=new LinkedHashMap<String,Object>();result.put("id",rs.getObject("id",UUID.class));result.put("status",rs.getString("status"));result.put("checkIn",rs.getDate("check_in").toLocalDate());result.put("checkOut",rs.getDate("check_out").toLocalDate());result.put("guests",rs.getInt("guest_count"));result.put("currency",rs.getString("currency").trim());result.put("total",rs.getBigDecimal("total_amount"));result.put("holdExpiresAt",rs.getObject("hold_expires_at",OffsetDateTime.class));result.put("createdAt",rs.getObject("created_at",OffsetDateTime.class));result.put("hotelPayment",rs.getString("hotel_payment"));result.put("subtotal",rs.getBigDecimal("subtotal_amount"));result.put("discount",rs.getBigDecimal("discount_amount"));result.put("promoCode",rs.getString("promo_code"));result.put("hotel",Map.of("name",rs.getString("hotel_name"),"address",rs.getString("address"),"city",rs.getString("city"),"country",rs.getString("country")));return result;},reservationId,guestId);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Reservation not found");
        var result=rows.getFirst();
        var rooms=jdbc.query("SELECT rr.room_type_name,rr.line_total,rr.currency,rr.nightly_rates::text AS nightly_rates,r.room_number,r.floor FROM reservation_room rr JOIN room r ON r.id=rr.room_id WHERE rr.reservation_id=? ORDER BY r.room_number",
            (rs,n)->{var room=new LinkedHashMap<String,Object>();room.put("roomType",rs.getString("room_type_name"));room.put("lineTotal",rs.getBigDecimal("line_total"));room.put("currency",rs.getString("currency").trim());room.put("roomNumber",rs.getString("room_number"));room.put("floor",rs.getObject("floor"));try{room.put("nightlyRates",json.readTree(rs.getString("nightly_rates")));}catch(JsonProcessingException e){throw new IllegalStateException("Stored reservation pricing is invalid",e);}return room;},reservationId);
        result.put("rooms",rooms);
        result.put("guest",jdbc.queryForObject("SELECT full_name,email,phone FROM app_user WHERE id=?",(rs,n)->{var guest=new LinkedHashMap<String,Object>();guest.put("name",rs.getString("full_name"));guest.put("email",rs.getString("email"));guest.put("phone",rs.getString("phone"));return guest;},guestId));
        result.put("payment",receiptPayment(reservationId));
        return result;
    }

    /**
     * The payment a receipt describes: the settled one (online or at the desk) if any, otherwise a pay-at-hotel
     * balance still due; null when nothing was paid or promised. Refunds are summed so a receipt can show them.
     */
    private Map<String,Object> receiptPayment(UUID reservationId){
        var rows=jdbc.query("""
            SELECT p.id,p.provider,p.status,p.amount,p.currency,p.updated_at,
                   COALESCE((SELECT sum(f.amount) FROM refund f WHERE f.payment_id=p.id AND f.status='SUCCEEDED'),0) AS refunded
            FROM payment p WHERE p.reservation_id=? AND p.status IN ('SUCCEEDED','REFUNDED','PENDING')
              AND (p.provider='hotel' OR p.status<>'PENDING')
            ORDER BY CASE WHEN p.status IN ('SUCCEEDED','REFUNDED') THEN 0 ELSE 1 END, p.updated_at DESC LIMIT 1
            """,(rs,n)->{var payment=new LinkedHashMap<String,Object>();
                payment.put("receiptNumber","SE-"+rs.getObject("id",UUID.class).toString().substring(0,8).toUpperCase(java.util.Locale.ROOT));
                payment.put("method","hotel".equals(rs.getString("provider"))?"PAY_AT_HOTEL":"CARD_ONLINE");
                payment.put("status",rs.getString("status"));payment.put("amount",rs.getBigDecimal("amount"));payment.put("currency",rs.getString("currency").trim());
                payment.put("paidAt","PENDING".equals(rs.getString("status"))?null:rs.getObject("updated_at",OffsetDateTime.class));
                payment.put("refunded",rs.getBigDecimal("refunded"));return payment;},reservationId);
        return rows.isEmpty()?null:rows.getFirst();
    }
}

