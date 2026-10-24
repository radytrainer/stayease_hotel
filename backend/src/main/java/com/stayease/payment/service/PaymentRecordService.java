package com.stayease.payment.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import com.stayease.reservation.entity.ReservationStatus;
import com.stayease.notification.service.NotificationService;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class PaymentRecordService {
    private final JdbcTemplate jdbc; private final NotificationService notifications; private final HotelPaymentService hotelPayments;
    public PaymentRecordService(JdbcTemplate jdbc,NotificationService notifications,HotelPaymentService hotelPayments){this.jdbc=jdbc;this.notifications=notifications;this.hotelPayments=hotelPayments;}
    public record CheckoutOrder(UUID paymentId,UUID reservationId,BigDecimal amount,String currency,String idempotencyKey,String url){}

    @Transactional
    public CheckoutOrder prepare(UUID guestId,UUID reservationId) {
        var stays=jdbc.query("SELECT status,hold_expires_at,total_amount,currency FROM reservation WHERE id=? AND guest_id=? FOR UPDATE",(rs,n)->new Object[]{rs.getString(1),rs.getObject(2,OffsetDateTime.class),rs.getBigDecimal(3),rs.getString(4).trim()},reservationId,guestId);
        if(stays.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Reservation not found");
        Object[] stay=stays.getFirst();
        if(!"PENDING_PAYMENT".equals(stay[0]) || stay[1]==null || !((OffsetDateTime)stay[1]).isAfter(OffsetDateTime.now())) throw new ResponseStatusException(HttpStatus.CONFLICT,"Reservation payment hold has expired");
        if(((BigDecimal)stay[2]).signum()==0) throw new ResponseStatusException(HttpStatus.CONFLICT,"Nothing is due after your discount. Choose Pay at hotel to confirm this booking.");
        var existing=jdbc.query("SELECT id,amount,currency,idempotency_key,checkout_url,status FROM payment WHERE reservation_id=? AND provider='stripe' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",(rs,n)->new Object[]{new CheckoutOrder(rs.getObject(1,UUID.class),reservationId,rs.getBigDecimal(2),rs.getString(3).trim(),rs.getString(4),rs.getString(5)),rs.getString(6)},reservationId);
        if(!existing.isEmpty()) {
            String status=(String)existing.getFirst()[1];
            // A declined card can be retried on the same Stripe session; a FAILED (refunded mismatch) payment needs a fresh one.
            if(java.util.Set.of("CREATED","PENDING","DECLINED").contains(status)) return (CheckoutOrder)existing.getFirst()[0];
            if(!"FAILED".equals(status)) throw new ResponseStatusException(HttpStatus.CONFLICT,"This reservation has already been paid");
        }
        UUID paymentId=UUID.randomUUID();String key="stayease-checkout-"+paymentId;
        jdbc.update("INSERT INTO payment(id,reservation_id,provider,idempotency_key,amount,currency,status) VALUES(?,?,'stripe',?,?,?,'CREATED')",paymentId,reservationId,key,(BigDecimal)stay[2],(String)stay[3]);
        jdbc.update("UPDATE reservation SET hold_expires_at=now()+interval '40 minutes',updated_at=now() WHERE id=?",reservationId);
        return new CheckoutOrder(paymentId,reservationId,(BigDecimal)stay[2],(String)stay[3],key,null);
    }

    @Transactional
    public void saveCheckout(UUID paymentId,PaymentGateway.CheckoutSession checkout) {
        jdbc.update("UPDATE payment SET provider_reference=?,checkout_url=?,status='PENDING',updated_at=now() WHERE id=? AND status IN ('CREATED','PENDING')",checkout.reference(),checkout.url(),paymentId);
    }

    @Transactional
    public String process(PaymentGateway.VerifiedEvent event) {
        if(jdbc.update("INSERT INTO payment_webhook_event(provider,event_id) VALUES('stripe',?) ON CONFLICT(provider,event_id) DO NOTHING",event.eventId())==0) return "duplicate";
        if(event.reservationId()==null || event.paymentIntentId()==null || event.paymentIntentId().isBlank()) return finishEvent(event,"ignored");
        var reservations=jdbc.query("SELECT status,hold_expires_at FROM reservation WHERE id=? FOR UPDATE",(rs,n)->new Object[]{rs.getString(1),rs.getObject(2,OffsetDateTime.class)},event.reservationId());
        if(reservations.isEmpty()) return finishEvent(event,"unmatched");
        var payments=jdbc.query("SELECT id,amount,currency,status FROM payment WHERE reservation_id=? AND provider='stripe' ORDER BY created_at DESC LIMIT 1 FOR UPDATE",(rs,n)->new Object[]{rs.getObject(1,UUID.class),rs.getBigDecimal(2),rs.getString(3).trim(),rs.getString(4)},event.reservationId());
        if(payments.isEmpty()) return finishEvent(event,"unmatched");
        UUID paymentId=(UUID)payments.getFirst()[0];
        if(event.type().equals("payment_intent.payment_failed")) {
            jdbc.update("UPDATE payment SET status='DECLINED',provider_payment_reference=?,updated_at=now() WHERE id=? AND status IN ('CREATED','PENDING','DECLINED')",event.paymentIntentId(),paymentId);
            return finishEvent(event,"declined");
        }
        if(!event.type().equals("payment_intent.succeeded")) return finishEvent(event,"ignored");
        if("SUCCEEDED".equals(payments.getFirst()[3])||"REFUNDED".equals(payments.getFirst()[3])) return finishEvent(event,"already-settled");
        String expected=StripePaymentGateway.minorUnits((BigDecimal)payments.getFirst()[1],(String)payments.getFirst()[2]);
        if(event.amountMinor()==null || event.amountMinor()<0 || !expected.equals(Long.toString(event.amountMinor())) || !((String)payments.getFirst()[2]).equalsIgnoreCase(event.currency())) {
            if(event.amountMinor()!=null&&event.amountMinor()>0&&event.currency()!=null&&!event.currency().isBlank()){
                BigDecimal received=StripePaymentGateway.decimalAmount(event.amountMinor(),event.currency());
                // The money is returned in full and the booking stays unpaid, so this payment must never count as revenue.
                jdbc.update("UPDATE payment SET status='FAILED',provider_payment_reference=?,updated_at=now() WHERE id=?",event.paymentIntentId(),paymentId);
                jdbc.update("INSERT INTO payment_reconciliation(payment_id,action,provider_reference,idempotency_key,refund_amount,refund_currency) VALUES(?,'REFUND_LATE_SUCCESS',?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING",paymentId,event.paymentIntentId(),"mismatch-refund-"+paymentId,received,event.currency());
                return finishEvent(event,"refund-queued-mismatch");
            }
            return finishEvent(event,"amount-mismatch");
        }
        Object[] reservation=reservations.getFirst();
        jdbc.update("UPDATE payment SET status='SUCCEEDED',provider_payment_reference=?,updated_at=now() WHERE id=?",event.paymentIntentId(),paymentId);
        String reservationStatus=(String)reservation[0];
        boolean active="PENDING_PAYMENT".equals(reservationStatus) && reservation[1]!=null && ((OffsetDateTime)reservation[1]).isAfter(OffsetDateTime.now());
        if(active) {
            ReservationStatus.PENDING_PAYMENT.transitionTo(ReservationStatus.CONFIRMED,true);
            jdbc.update("UPDATE reservation SET status='CONFIRMED',hold_expires_at=NULL,updated_at=now() WHERE id=?",event.reservationId());
            jdbc.update("INSERT INTO reservation_status_history(reservation_id,from_status,to_status,reason) VALUES(?,'PENDING_PAYMENT','CONFIRMED','Verified Stripe payment authorization')",event.reservationId());
            notifications.enqueueReservationEvent(event.reservationId(),"RESERVATION_CONFIRMED");
            return finishEvent(event,"confirmed");
        }
        if(java.util.Set.of("CONFIRMED","CHECKED_IN","CHECKED_OUT","COMPLETED").contains(reservationStatus)) {
            // Guest chose pay-at-hotel, then finished an open Stripe tab anyway: the desk must not collect a second time.
            hotelPayments.voidOutstanding(event.reservationId());
            return finishEvent(event,"already-confirmed");
        }
        if(!java.util.Set.of("PENDING_PAYMENT","EXPIRED","CANCELLED").contains(reservationStatus)) return finishEvent(event,"ignored");
        String compensationKey="late-refund-"+paymentId;
        jdbc.update("INSERT INTO payment_reconciliation(payment_id,action,provider_reference,idempotency_key,refund_amount,refund_currency) VALUES(?,'REFUND_LATE_SUCCESS',?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING",paymentId,event.paymentIntentId(),compensationKey,(BigDecimal)payments.getFirst()[1],event.currency());
        return finishEvent(event,"refund-queued");
    }

    private String finishEvent(PaymentGateway.VerifiedEvent event,String outcome) {
        jdbc.update("UPDATE payment_webhook_event SET processed_at=now(),outcome=? WHERE provider='stripe' AND event_id=?",outcome,event.eventId());
        return outcome;
    }

    @Transactional(readOnly=true)
    public java.util.List<Object[]> pendingRefunds(){return jdbc.query("SELECT id,payment_id,provider_reference,idempotency_key FROM payment_reconciliation WHERE status IN ('PENDING','FAILED') AND attempts<10 ORDER BY created_at LIMIT 50",(rs,n)->new Object[]{rs.getObject(1,UUID.class),rs.getObject(2,UUID.class),rs.getString(3),rs.getString(4)});}

    @Transactional
    public Object[] refundDetails(UUID workId){var rows=jdbc.query("SELECT w.payment_id,w.provider_reference,w.idempotency_key,w.refund_amount,w.refund_currency,w.cancellation_id FROM payment_reconciliation w WHERE w.id=? AND w.status IN ('PENDING','FAILED') AND w.attempts<10 FOR UPDATE",(rs,n)->new Object[]{rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3),rs.getBigDecimal(4),rs.getString(5).trim(),rs.getObject(6,UUID.class)},workId);return rows.isEmpty()?null:rows.getFirst();}

    @Transactional
    public void refundSucceeded(UUID workId,UUID paymentId,UUID cancellationId,String idempotencyKey,String providerReference,BigDecimal amount,String currency){
        int recorded=jdbc.update("INSERT INTO refund(cancellation_id,payment_id,provider_reference,amount,status,idempotency_key) VALUES(?,?,?,?, 'SUCCEEDED',?) ON CONFLICT(idempotency_key) DO NOTHING",cancellationId,paymentId,providerReference,amount,idempotencyKey);
        // Only settled payments move between SUCCEEDED and REFUNDED; a FAILED mismatch refund must not turn into revenue.
        jdbc.update("UPDATE payment p SET status=CASE WHEN (SELECT COALESCE(sum(r.amount),0) FROM refund r WHERE r.payment_id=p.id)>=p.amount THEN 'REFUNDED' ELSE 'SUCCEEDED' END,updated_at=now() WHERE p.id=? AND p.status IN ('SUCCEEDED','REFUNDED')",paymentId);
        jdbc.update("UPDATE payment_reconciliation SET status='SUCCEEDED',attempts=attempts+1,updated_at=now() WHERE id=?",workId);
        if(recorded>0) {
            UUID reservationId=jdbc.queryForObject("SELECT reservation_id FROM payment WHERE id=?",UUID.class,paymentId);
            notifications.enqueueReservationEvent(reservationId,"REFUND_ISSUED",java.util.Map.of("refundAmount",amount,"refundCurrency",currency));
        }
    }
    @Transactional
    public void refundFailed(UUID workId){jdbc.update("UPDATE payment_reconciliation SET status='FAILED',attempts=attempts+1,last_error='Provider refund attempt failed',updated_at=now() WHERE id=?",workId);}
}

