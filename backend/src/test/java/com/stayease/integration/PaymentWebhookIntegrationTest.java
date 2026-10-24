package com.stayease.integration;

import com.stayease.payment.service.PaymentGateway;
import com.stayease.payment.service.PaymentReconciliationWorker;
import com.stayease.payment.service.PaymentRecordService;
import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.service.CancellationService;
import com.stayease.reservation.service.ReservationHoldExpiry;
import com.stayease.reservation.service.ReservationService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Drives the Stripe webhook endpoint with correctly signed payloads, exactly as Stripe delivers them, and follows each
 * outcome through the database and the refund worker. Only the outbound Stripe refund call is stubbed.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.payment.stripe-webhook-secret=" + PaymentWebhookIntegrationTest.SECRET)
class PaymentWebhookIntegrationTest extends PostgresIntegrationTest {
    static final String SECRET = "whsec_integration_test";

    @Autowired MockMvc mvc;
    @Autowired ReservationService reservations;
    @Autowired PaymentRecordService payments;
    @Autowired ReservationHoldExpiry holdExpiry;
    @Autowired CancellationService cancellations;
    @Autowired PaymentReconciliationWorker refundWorker;
    @MockitoSpyBean PaymentGateway gateway;

    private final LocalDate checkIn = LocalDate.now().plusDays(120);

    /** A guest with a 2-night, $100.00 hold that has started Stripe checkout. */
    private record Booking(UUID guest, UUID hotel, UUID reservation, UUID payment) {}

    private Booking heldBooking(boolean refundablePolicy) {
        UUID guest = guest(), hotel = approvedHotel();
        if (refundablePolicy) jdbc.update("INSERT INTO cancellation_policy(hotel_id,name,free_cancel_hours,refund_percent) VALUES(?,'Flexible',24,100)", hotel);
        UUID type = roomType(hotel, "Double", 2, "50.00"), room = room(hotel, type, "201");
        UUID reservation = reservations.create(guest, new ReservationCreateRequest(hotel, checkIn, checkIn.plusDays(2), 2, List.of(room), UUID.randomUUID().toString())).id();
        return new Booking(guest, hotel, reservation, payments.prepare(guest, reservation).paymentId());
    }

    private static String event(String id, String type, String intent, UUID reservation, long amountMinor, String currency) {
        String metadata = reservation == null ? "{}" : "{\"reservation_id\":\"" + reservation + "\"}";
        return "{\"id\":\"" + id + "\",\"type\":\"" + type + "\",\"data\":{\"object\":{\"id\":\"" + intent + "\",\"object\":\"payment_intent\","
            + "\"amount\":" + amountMinor + ",\"amount_received\":" + (type.equals("payment_intent.succeeded") ? amountMinor : 0)
            + ",\"currency\":\"" + currency + "\",\"metadata\":" + metadata + "}}}";
    }
    private static String sign(String payload, String secret, long timestamp) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        return "t=" + timestamp + ",v1=" + HexFormat.of().formatHex(mac.doFinal((timestamp + "." + payload).getBytes(StandardCharsets.UTF_8)));
    }
    private ResultActions deliver(String payload, String signature) throws Exception {
        var request = post("/api/v1/payments/webhooks/stripe").contentType(MediaType.APPLICATION_JSON).content(payload);
        return mvc.perform(signature == null ? request : request.header("Stripe-Signature", signature));
    }
    private ResultActions deliver(String payload) throws Exception {
        return deliver(payload, sign(payload, SECRET, Instant.now().getEpochSecond()));
    }
    private static String evt() { return "evt_" + UUID.randomUUID(); }

    private String reservationStatus(UUID id) { return jdbc.queryForObject("SELECT status FROM reservation WHERE id=?", String.class, id); }
    private String paymentStatus(UUID id) { return jdbc.queryForObject("SELECT status FROM payment WHERE id=?", String.class, id); }
    private int notifications(UUID reservation, String template) {
        return jdbc.queryForObject("SELECT count(*) FROM notification WHERE reservation_id=? AND template=? AND channel='IN_APP'", Integer.class, reservation, template);
    }
    /** Same net-revenue formula as the manager overview report. */
    private BigDecimal revenue(UUID hotel) {
        return jdbc.queryForObject("SELECT COALESCE(sum(p.amount-COALESCE((SELECT sum(rf.amount) FROM refund rf WHERE rf.payment_id=p.id AND rf.status='SUCCEEDED'),0)),0) FROM payment p JOIN reservation r ON r.id=p.reservation_id WHERE r.hotel_id=? AND p.status IN ('SUCCEEDED','REFUNDED')", BigDecimal.class, hotel);
    }
    private void stubRefunds() {
        doAnswer(call -> new PaymentGateway.RefundResult("re_" + UUID.randomUUID(), "succeeded")).when(gateway).refund(any(), any(), any(), any());
    }

    @Test void signedSuccessConfirmsTheHoldExactlyOnceEvenWhenStripeRetries() throws Exception {
        Booking b = heldBooking(false);
        String first = evt(), payload = event(first, "payment_intent.succeeded", "pi_ok", b.reservation(), 10000, "usd");

        deliver(payload).andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("confirmed"));
        assertEquals("CONFIRMED", reservationStatus(b.reservation()));
        assertNull(jdbc.queryForObject("SELECT hold_expires_at FROM reservation WHERE id=?", Object.class, b.reservation()));
        assertEquals("SUCCEEDED", paymentStatus(b.payment()));
        assertEquals("pi_ok", jdbc.queryForObject("SELECT provider_payment_reference FROM payment WHERE id=?", String.class, b.payment()));
        assertEquals(1, notifications(b.reservation(), "RESERVATION_CONFIRMED"));
        assertEquals(0, new BigDecimal("100.00").compareTo(revenue(b.hotel())));

        // Stripe redelivers the same event, then (rarely) a second event for the same intent.
        deliver(payload).andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("duplicate"));
        deliver(event(evt(), "payment_intent.succeeded", "pi_ok", b.reservation(), 10000, "usd")).andExpect(jsonPath("$.outcome").value("already-settled"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM reservation_status_history WHERE reservation_id=? AND to_status='CONFIRMED'", Integer.class, b.reservation()));
        assertEquals(1, notifications(b.reservation(), "RESERVATION_CONFIRMED"));
        assertEquals("confirmed", jdbc.queryForObject("SELECT outcome FROM payment_webhook_event WHERE event_id=?", String.class, first));
    }

    @Test void unsignedForgedTamperedOrReplayedEventsAreRejectedWithoutSideEffects() throws Exception {
        Booking b = heldBooking(false);
        String id = evt(), payload = event(id, "payment_intent.succeeded", "pi_forged", b.reservation(), 10000, "usd");
        long now = Instant.now().getEpochSecond();

        deliver(payload, null).andExpect(status().isBadRequest());
        deliver(payload, sign(payload, "whsec_attacker", now)).andExpect(status().isBadRequest());
        deliver(payload.replace("10000", "1"), sign(payload, SECRET, now)).andExpect(status().isBadRequest());
        deliver(payload, sign(payload, SECRET, now - 600)).andExpect(status().isBadRequest());
        deliver(payload, "t=" + now + ",v0=" + "0".repeat(64)).andExpect(status().isBadRequest());

        assertEquals("PENDING_PAYMENT", reservationStatus(b.reservation()));
        assertEquals("CREATED", paymentStatus(b.payment()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM payment_webhook_event WHERE event_id=?", Integer.class, id));
        // The genuine delivery of that same event still works afterwards.
        deliver(payload).andExpect(jsonPath("$.outcome").value("confirmed"));
    }

    @Test void aDeclinedCardKeepsTheHoldSoTheGuestCanRetry() throws Exception {
        Booking b = heldBooking(false);

        deliver(event(evt(), "payment_intent.payment_failed", "pi_retry", b.reservation(), 10000, "usd"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("declined"));
        assertEquals("DECLINED", paymentStatus(b.payment()));
        assertEquals("PENDING_PAYMENT", reservationStatus(b.reservation()));
        assertEquals(b.payment(), payments.prepare(b.guest(), b.reservation()).paymentId(), "retry reuses the open Stripe session");
        assertEquals(0, revenue(b.hotel()).signum());

        deliver(event(evt(), "payment_intent.succeeded", "pi_retry", b.reservation(), 10000, "usd")).andExpect(jsonPath("$.outcome").value("confirmed"));
        assertEquals("CONFIRMED", reservationStatus(b.reservation()));
    }

    @Test void paymentAfterTheHoldExpiredIsRefundedInFullAndTheGuestIsTold() throws Exception {
        stubRefunds();
        Booking b = heldBooking(false);
        jdbc.update("UPDATE reservation SET hold_expires_at=now()-interval '1 minute' WHERE id=?", b.reservation());
        holdExpiry.releaseExpiredHolds();
        assertEquals("EXPIRED", reservationStatus(b.reservation()));
        assertEquals(1, notifications(b.reservation(), "RESERVATION_EXPIRED"));

        deliver(event(evt(), "payment_intent.succeeded", "pi_late", b.reservation(), 10000, "usd")).andExpect(jsonPath("$.outcome").value("refund-queued"));
        assertEquals("EXPIRED", reservationStatus(b.reservation()), "a late payment must not revive released inventory");
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM room_occupancy o JOIN reservation_room rr ON rr.id=o.reservation_room_id WHERE rr.reservation_id=? AND o.active", Integer.class, b.reservation()));

        refundWorker.refundLateAuthorizations();
        refundWorker.refundLateAuthorizations();

        verify(gateway, times(1)).refund(eq("pi_late"), argThat(a -> a.compareTo(new BigDecimal("100.00")) == 0), eq("USD"), eq("late-refund-" + b.payment()));
        assertEquals("REFUNDED", paymentStatus(b.payment()));
        assertEquals(0, revenue(b.hotel()).signum());
        assertEquals("SUCCEEDED", jdbc.queryForObject("SELECT status FROM payment_reconciliation WHERE payment_id=?", String.class, b.payment()));
        assertEquals(1, notifications(b.reservation(), "REFUND_ISSUED"));
        assertEquals("100.0000", jdbc.queryForObject("SELECT payload->>'refundAmount' FROM notification WHERE reservation_id=? AND template='REFUND_ISSUED' AND channel='IN_APP'", String.class, b.reservation()));
    }

    @Test void aWrongAmountIsRefundedNeverCountsAsRevenueAndTheGuestCanPayAgain() throws Exception {
        stubRefunds();
        Booking b = heldBooking(false);

        deliver(event(evt(), "payment_intent.succeeded", "pi_short", b.reservation(), 5000, "usd")).andExpect(jsonPath("$.outcome").value("refund-queued-mismatch"));
        assertEquals("PENDING_PAYMENT", reservationStatus(b.reservation()));
        assertEquals("FAILED", paymentStatus(b.payment()));

        refundWorker.refundLateAuthorizations();
        verify(gateway).refund(eq("pi_short"), argThat(a -> a.compareTo(new BigDecimal("50.00")) == 0), eq("USD"), any());
        assertEquals("FAILED", paymentStatus(b.payment()), "a partial refund must not promote the payment to SUCCEEDED");
        assertEquals(0, revenue(b.hotel()).signum());
        assertEquals(1, notifications(b.reservation(), "REFUND_ISSUED"));

        UUID retry = payments.prepare(b.guest(), b.reservation()).paymentId();
        assertNotEquals(b.payment(), retry, "the guest gets a fresh checkout instead of the spent one");
        deliver(event(evt(), "payment_intent.succeeded", "pi_full", b.reservation(), 10000, "usd")).andExpect(jsonPath("$.outcome").value("confirmed"));
        assertEquals(0, new BigDecimal("100.00").compareTo(revenue(b.hotel())));
    }

    @Test void cancellingAPaidBookingRefundsPerPolicyAndNotifiesOnceTheMoneyIsBack() throws Exception {
        stubRefunds();
        Booking b = heldBooking(true);
        deliver(event(evt(), "payment_intent.succeeded", "pi_cancel", b.reservation(), 10000, "usd")).andExpect(jsonPath("$.outcome").value("confirmed"));

        var result = cancellations.cancel(b.guest(), b.reservation(), "Change of plans");
        assertEquals(0, new BigDecimal("100.00").compareTo(result.refundAmount()));
        assertEquals(0, notifications(b.reservation(), "REFUND_ISSUED"), "no refund message until Stripe has actually refunded");

        refundWorker.refundLateAuthorizations();
        assertEquals("REFUNDED", paymentStatus(b.payment()));
        assertEquals(0, revenue(b.hotel()).signum());
        assertNotNull(jdbc.queryForObject("SELECT cancellation_id FROM refund WHERE payment_id=?", UUID.class, b.payment()));
        assertEquals(1, notifications(b.reservation(), "REFUND_ISSUED"));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM refund WHERE payment_id=? AND idempotency_key LIKE 'late-refund-%'", Integer.class, b.payment()));
    }

    @Test void eventsStayeaseCannotUseAreAcknowledgedSoStripeStopsRetrying() throws Exception {
        Booking b = heldBooking(false);
        deliver(event(evt(), "payment_intent.succeeded", "pi_other_site", null, 10000, "usd")).andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("ignored"));
        deliver(event(evt(), "payment_intent.succeeded", "pi_unknown", UUID.randomUUID(), 10000, "usd")).andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("unmatched"));
        deliver(event(evt(), "payment_intent.created", "pi_created", b.reservation(), 10000, "usd")).andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("ignored"));
        assertEquals("PENDING_PAYMENT", reservationStatus(b.reservation()));
        assertEquals("CREATED", paymentStatus(b.payment()));
    }
}
