package com.stayease.integration;

import com.stayease.auth.service.BearerSessionFilter;
import com.stayease.payment.service.PaymentRecordService;
import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.service.ReservationService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** "Pay at hotel" end to end over HTTP: the guest's choice, the front desk and manager recording money, cancellation and Stripe overlap. */
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.payment.stripe-webhook-secret=" + PayAtHotelIntegrationTest.SECRET)
class PayAtHotelIntegrationTest extends PostgresIntegrationTest {
    static final String SECRET = "whsec_pay_at_hotel_test";

    @Autowired MockMvc mvc;
    @Autowired ReservationService reservations;
    @Autowired PaymentRecordService payments;

    private final LocalDate checkIn = LocalDate.now().plusDays(30);

    private record Booking(UUID guest, String guestToken, UUID hotel, UUID reservation) {}

    private String tokenFor(UUID user) {
        String token = UUID.randomUUID() + "-" + UUID.randomUUID();
        jdbc.update("INSERT INTO auth_session(user_id,token_hash,expires_at) VALUES(?,?,?)", user, BearerSessionFilter.hash(token), OffsetDateTime.now().plusHours(1));
        return token;
    }
    private String staff(UUID hotel, String role) {
        UUID id = guest();
        jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?,?)", id, role);
        jdbc.update("INSERT INTO hotel_staff(hotel_id,user_id,staff_role) VALUES(?,?,?)", hotel, id, role);
        return tokenFor(id);
    }
    private Booking held(UUID hotel) {
        String suffix = UUID.randomUUID().toString().substring(0, 6);
        UUID guest = guest(), type = roomType(hotel, "Twin " + suffix, 2, "50.00"), room = room(hotel, type, "T-" + suffix);
        UUID reservation = reservations.create(guest, new ReservationCreateRequest(hotel, checkIn, checkIn.plusDays(2), 2, List.of(room), UUID.randomUUID().toString())).id();
        return new Booking(guest, tokenFor(guest), hotel, reservation);
    }
    private static MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder request) { return request.header("Authorization", "Bearer " + token); }
    private ResultActions payAtHotel(Booking b) throws Exception { return mvc.perform(as(b.guestToken(), post("/api/v1/reservations/" + b.reservation() + "/pay-at-hotel"))); }

    private String hotelPayment(UUID reservation) { return jdbc.queryForObject("SELECT status FROM payment WHERE reservation_id=? AND provider='hotel'", String.class, reservation); }
    private String reservationStatus(UUID reservation) { return jdbc.queryForObject("SELECT status FROM reservation WHERE id=?", String.class, reservation); }
    private int activeRooms(UUID reservation) {
        return jdbc.queryForObject("SELECT count(*) FROM room_occupancy o JOIN reservation_room rr ON rr.id=o.reservation_room_id WHERE rr.reservation_id=? AND o.active", Integer.class, reservation);
    }
    private BigDecimal revenue(UUID hotel) {
        return jdbc.queryForObject("SELECT COALESCE(sum(p.amount-COALESCE((SELECT sum(rf.amount) FROM refund rf WHERE rf.payment_id=p.id AND rf.status='SUCCEEDED'),0)),0) FROM payment p JOIN reservation r ON r.id=p.reservation_id WHERE r.hotel_id=? AND p.status IN ('SUCCEEDED','REFUNDED')", BigDecimal.class, hotel);
    }

    @Test void checkoutPageLearnsWhichWaysToPayAreAvailable() throws Exception {
        mvc.perform(as(tokenFor(guest()), get("/api/v1/payments/options"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.online").value(false)).andExpect(jsonPath("$.payAtHotel").value(true));
    }

    @Test void choosingPayAtHotelConfirmsTheStayButOwesTheMoneyAtTheDesk() throws Exception {
        Booking b = held(approvedHotel());

        payAtHotel(b).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONFIRMED"))
            .andExpect(jsonPath("$.paymentMethod").value("HOTEL")).andExpect(jsonPath("$.amountDue").value(100.0));
        assertEquals("CONFIRMED", reservationStatus(b.reservation()));
        assertNull(jdbc.queryForObject("SELECT hold_expires_at FROM reservation WHERE id=?", Object.class, b.reservation()), "a confirmed stay no longer expires");
        assertEquals(1, activeRooms(b.reservation()), "the room stays reserved");
        assertEquals("PENDING", hotelPayment(b.reservation()));
        assertEquals(0, revenue(b.hotel()).signum(), "money not yet received is not revenue");
        assertEquals("HOTEL", jdbc.queryForObject("SELECT payload->>'paymentMethod' FROM notification WHERE reservation_id=? AND template='RESERVATION_CONFIRMED' AND channel='IN_APP'", String.class, b.reservation()));

        // A double click returns the same answer instead of failing or creating a second balance.
        payAtHotel(b).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CONFIRMED"));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM payment WHERE reservation_id=?", Integer.class, b.reservation()));

        mvc.perform(as(b.guestToken(), get("/api/v1/reservations"))).andExpect(jsonPath("$[0].hotelPayment").value("PENDING"));
        mvc.perform(as(b.guestToken(), get("/api/v1/reservations/" + b.reservation() + "/summary"))).andExpect(jsonPath("$.hotelPayment").value("PENDING"))
            .andExpect(jsonPath("$.payment.method").value("PAY_AT_HOTEL")).andExpect(jsonPath("$.payment.status").value("PENDING"))
            .andExpect(jsonPath("$.payment.paidAt").doesNotExist()).andExpect(jsonPath("$.payment.receiptNumber", startsWith("SE-")))
            .andExpect(jsonPath("$.guest.email", endsWith("@example.com")));
    }

    @Test void onlyTheOwnerOfALiveHoldCanChooseIt() throws Exception {
        Booking b = held(approvedHotel());
        mvc.perform(as(tokenFor(guest()), post("/api/v1/reservations/" + b.reservation() + "/pay-at-hotel"))).andExpect(status().isNotFound());
        mvc.perform(post("/api/v1/reservations/" + b.reservation() + "/pay-at-hotel")).andExpect(status().isUnauthorized());

        jdbc.update("UPDATE reservation SET hold_expires_at=now()-interval '1 second' WHERE id=?", b.reservation());
        payAtHotel(b).andExpect(status().isConflict());
        assertEquals("PENDING_PAYMENT", reservationStatus(b.reservation()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM payment WHERE reservation_id=?", Integer.class, b.reservation()));
    }

    @Test void receptionAndManagerRecordTheMoneyOnlyForTheirOwnHotel() throws Exception {
        UUID hotel = approvedHotel(), other = approvedHotel();
        Booking first = held(hotel), second = held(hotel);
        payAtHotel(first).andExpect(status().isOk());
        payAtHotel(second).andExpect(status().isOk());
        String receptionist = staff(hotel, "RECEPTIONIST"), manager = staff(hotel, "HOTEL_MANAGER");
        String strangerDesk = staff(other, "RECEPTIONIST"), strangerManager = staff(other, "HOTEL_MANAGER");

        mvc.perform(as(receptionist, get("/api/v1/reception/hotels/" + hotel + "/arrivals").param("date", checkIn.toString()))).andExpect(status().isOk())
            .andExpect(jsonPath("$[*].amount_due", everyItem(is(100.0))));
        mvc.perform(as(receptionist, get("/api/v1/reception/hotels/" + hotel + "/payments/outstanding"))).andExpect(jsonPath("$", hasSize(2)));

        mvc.perform(as(strangerDesk, post("/api/v1/reception/hotels/" + hotel + "/reservations/" + first.reservation() + "/payment-received"))).andExpect(status().isForbidden());
        mvc.perform(as(strangerDesk, post("/api/v1/reception/hotels/" + other + "/reservations/" + first.reservation() + "/payment-received"))).andExpect(status().isNotFound());
        mvc.perform(as(strangerManager, post("/api/v1/manager/hotels/" + hotel + "/reservations/" + first.reservation() + "/payment-received"))).andExpect(status().isForbidden());
        mvc.perform(as(first.guestToken(), post("/api/v1/reception/hotels/" + hotel + "/reservations/" + first.reservation() + "/payment-received"))).andExpect(status().isForbidden());
        assertEquals("PENDING", hotelPayment(first.reservation()));

        mvc.perform(as(receptionist, post("/api/v1/reception/hotels/" + hotel + "/reservations/" + first.reservation() + "/payment-received")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.paymentStatus").value("SUCCEEDED"));
        mvc.perform(as(receptionist, post("/api/v1/reception/hotels/" + hotel + "/reservations/" + first.reservation() + "/payment-received"))).andExpect(status().isOk());
        mvc.perform(as(manager, post("/api/v1/manager/hotels/" + hotel + "/reservations/" + second.reservation() + "/payment-received"))).andExpect(status().isOk());

        assertEquals("SUCCEEDED", hotelPayment(first.reservation()));
        assertEquals("SUCCEEDED", hotelPayment(second.reservation()));
        mvc.perform(as(first.guestToken(), get("/api/v1/reservations/" + first.reservation() + "/summary")))
            .andExpect(jsonPath("$.payment.status").value("SUCCEEDED")).andExpect(jsonPath("$.payment.paidAt").isNotEmpty());
        assertEquals(0, new BigDecimal("200.00").compareTo(revenue(hotel)));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE hotel_id=? AND action='HOTEL_PAYMENT_RECEIVED'", Integer.class, hotel));
        mvc.perform(as(manager, get("/api/v1/manager/hotels/" + hotel + "/payments/outstanding"))).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test void cancellingBeforePayingReleasesTheRoomAndOwesNothing() throws Exception {
        Booking b = held(approvedHotel());
        payAtHotel(b).andExpect(status().isOk());

        mvc.perform(as(b.guestToken(), post("/api/v1/reservations/" + b.reservation() + "/cancel"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CANCELLED")).andExpect(jsonPath("$.refundAmount").value(0));
        assertEquals("FAILED", hotelPayment(b.reservation()), "the desk balance is dropped");
        assertEquals(0, activeRooms(b.reservation()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM payment_reconciliation pr JOIN payment p ON p.id=pr.payment_id WHERE p.reservation_id=?", Integer.class, b.reservation()));

        String receptionist = staff(b.hotel(), "RECEPTIONIST");
        mvc.perform(as(receptionist, post("/api/v1/reception/hotels/" + b.hotel() + "/reservations/" + b.reservation() + "/payment-received"))).andExpect(status().isConflict());
    }

    @Test void moneyTakenAtTheDeskIsRefundedByTheHotelNotOnline() throws Exception {
        Booking b = held(approvedHotel());
        payAtHotel(b).andExpect(status().isOk());
        mvc.perform(as(staff(b.hotel(), "RECEPTIONIST"), post("/api/v1/reception/hotels/" + b.hotel() + "/reservations/" + b.reservation() + "/payment-received"))).andExpect(status().isOk());

        mvc.perform(as(b.guestToken(), post("/api/v1/reservations/" + b.reservation() + "/cancel"))).andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail", containsString("contact the hotel")));
        assertEquals("CONFIRMED", reservationStatus(b.reservation()));
    }

    @Test void payingOnlineAfterChoosingTheHotelClearsTheDeskBalance() throws Exception {
        Booking b = held(approvedHotel());
        UUID stripePayment = payments.prepare(b.guest(), b.reservation()).paymentId();   // Stripe tab opened first
        payAtHotel(b).andExpect(status().isOk());                                        // then pay-at-hotel chosen

        String payload = "{\"id\":\"evt_" + UUID.randomUUID() + "\",\"type\":\"payment_intent.succeeded\",\"data\":{\"object\":{\"id\":\"pi_both\",\"amount\":10000,\"amount_received\":10000,\"currency\":\"usd\",\"metadata\":{\"reservation_id\":\"" + b.reservation() + "\"}}}}";
        long now = Instant.now().getEpochSecond();
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String signature = "t=" + now + ",v1=" + HexFormat.of().formatHex(mac.doFinal((now + "." + payload).getBytes(StandardCharsets.UTF_8)));
        mvc.perform(post("/api/v1/payments/webhooks/stripe").contentType(MediaType.APPLICATION_JSON).content(payload).header("Stripe-Signature", signature))
            .andExpect(status().isOk()).andExpect(jsonPath("$.outcome").value("already-confirmed"));

        assertEquals("SUCCEEDED", jdbc.queryForObject("SELECT status FROM payment WHERE id=?", String.class, stripePayment));
        assertEquals("FAILED", hotelPayment(b.reservation()), "the desk must not collect a second time");
        assertEquals(0, new BigDecimal("100.00").compareTo(revenue(b.hotel())));
    }
}
