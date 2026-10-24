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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Hotel discount codes: the manager's rules, the guest's check, and the price the booking actually charges. */
@AutoConfigureMockMvc
class PromotionCodeIntegrationTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ReservationService reservations;
    @Autowired PaymentRecordService payments;

    private final LocalDate checkIn = LocalDate.now().plusDays(40);

    private String tokenFor(UUID user) {
        String token = UUID.randomUUID() + "-" + UUID.randomUUID();
        jdbc.update("INSERT INTO auth_session(user_id,token_hash,expires_at) VALUES(?,?,?)", user, BearerSessionFilter.hash(token), OffsetDateTime.now().plusHours(1));
        return token;
    }
    private String manager(UUID hotel) {
        UUID id = guest();
        jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?,'HOTEL_MANAGER')", id);
        jdbc.update("INSERT INTO hotel_staff(hotel_id,user_id,staff_role) VALUES(?,?,'HOTEL_MANAGER')", hotel, id);
        return tokenFor(id);
    }
    private static MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder r) { return r.header("Authorization", "Bearer " + token); }
    private void createCode(String token, UUID hotel, String json) throws Exception {
        mvc.perform(as(token, post("/api/v1/manager/hotels/" + hotel + "/promotions")).contentType(MediaType.APPLICATION_JSON).content(json)).andExpect(status().isCreated());
    }
    /** A $50-a-night room; returns its id. */
    private UUID room(UUID hotel) { return room(hotel, roomType(hotel, "Room " + UUID.randomUUID().toString().substring(0, 6), 2, "50.00"), "R" + UUID.randomUUID().toString().substring(0, 6)); }
    private ReservationCreateRequest stay(UUID hotel, UUID room, int nights, String code) {
        return new ReservationCreateRequest(hotel, checkIn, checkIn.plusDays(nights), 2, List.of(room), UUID.randomUUID().toString(), code);
    }
    private String reason(Executable e) { return assertThrows(ResponseStatusException.class, e::run).getReason(); }
    interface Executable { void run() throws Exception; }

    @Test void aPercentCodeLowersWhatTheGuestPaysAndIsRecordedOnTheBooking() throws Exception {
        UUID hotel = approvedHotel(), room = room(hotel), guest = guest();
        createCode(manager(hotel), hotel, "{\"code\":\"save10\",\"description\":\"Rainy season\",\"discountType\":\"PERCENT\",\"discountValue\":10}");

        var booked = reservations.create(guest, stay(hotel, room, 2, " Save10 "));
        assertEquals(0, new BigDecimal("90.00").compareTo(booked.total()), "10% off 2 nights at $50");
        assertEquals(0, new BigDecimal("90.00").compareTo(payments.prepare(guest, booked.id()).amount()), "checkout charges the discounted total");

        mvc.perform(as(tokenFor(guest), get("/api/v1/reservations/" + booked.id() + "/summary"))).andExpect(status().isOk())
            .andExpect(jsonPath("$.subtotal").value(100.0)).andExpect(jsonPath("$.discount").value(10.0))
            .andExpect(jsonPath("$.total").value(90.0)).andExpect(jsonPath("$.promoCode").value("SAVE10"));
    }

    @Test void aFixedCodeRespectsMinimumStayAndNeverGoesBelowZero() throws Exception {
        UUID hotel = approvedHotel(), guest = guest();
        String token = manager(hotel);
        createCode(token, hotel, "{\"code\":\"LONGSTAY\",\"discountType\":\"FIXED\",\"discountValue\":15,\"minNights\":2,\"onePerGuest\":false}");
        createCode(token, hotel, "{\"code\":\"FREENIGHT\",\"discountType\":\"FIXED\",\"discountValue\":500,\"onePerGuest\":false}");

        assertEquals("This code needs a stay of at least 2 nights", reason(() -> reservations.create(guest, stay(hotel, room(hotel), 1, "LONGSTAY"))));
        assertEquals(0, new BigDecimal("85.00").compareTo(reservations.create(guest, stay(hotel, room(hotel), 2, "LONGSTAY")).total()));

        var free = reservations.create(guest, stay(hotel, room(hotel), 1, "FREENIGHT"));
        assertEquals(0, free.total().signum(), "a discount larger than the stay is capped at the stay price");
        assertTrue(reason(() -> payments.prepare(guest, free.id())).contains("Pay at hotel"), "a $0 booking cannot go to Stripe");
    }

    @Test void usageLimitsCountLiveBookingsAndGiveUsesBackWhenAHoldExpires() throws Exception {
        UUID hotel = approvedHotel(), first = guest(), second = guest();
        createCode(manager(hotel), hotel, "{\"code\":\"FIRST1\",\"discountType\":\"PERCENT\",\"discountValue\":20,\"maxUses\":1}");

        var used = reservations.create(first, stay(hotel, room(hotel), 1, "FIRST1"));
        assertEquals("You’ve already used this code", reason(() -> reservations.create(first, stay(hotel, room(hotel), 1, "FIRST1"))));
        assertEquals("This code has been fully used", reason(() -> reservations.create(second, stay(hotel, room(hotel), 1, "FIRST1"))));

        jdbc.update("UPDATE reservation SET status='EXPIRED' WHERE id=?", used.id());
        assertNotNull(reservations.create(second, stay(hotel, room(hotel), 1, "FIRST1")), "an expired hold gives its use back");
    }

    @Test void twoGuestsRacingForTheLastUseGetExactlyOne() throws Exception {
        UUID hotel = approvedHotel();
        createCode(manager(hotel), hotel, "{\"code\":\"LASTONE\",\"discountType\":\"PERCENT\",\"discountValue\":50,\"maxUses\":1}");
        List<UUID> rooms = List.of(room(hotel), room(hotel), room(hotel), room(hotel));
        ExecutorService pool = Executors.newFixedThreadPool(4);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> results = new ArrayList<>();
        for (UUID room : rooms) { UUID g = guest(); results.add(pool.submit(() -> { start.await(); try { reservations.create(g, stay(hotel, room, 1, "LASTONE")); return true; } catch (ResponseStatusException e) { return false; } })); }
        start.countDown();
        int won = 0; for (Future<Boolean> f : results) if (f.get(30, TimeUnit.SECONDS)) won++;
        pool.shutdown();
        assertEquals(1, won);
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM reservation r JOIN promotion_code p ON p.id=r.promotion_code_id WHERE p.code='LASTONE' AND p.hotel_id=?", Integer.class, hotel));
    }

    @Test void datesActiveFlagAndHotelScopeAreEnforced() throws Exception {
        UUID hotel = approvedHotel(), other = approvedHotel(), guest = guest();
        String token = manager(hotel);
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Phnom_Penh"));
        createCode(token, hotel, "{\"code\":\"OLDSALE\",\"discountType\":\"PERCENT\",\"discountValue\":5,\"endsOn\":\"" + today.minusDays(1) + "\"}");
        createCode(token, hotel, "{\"code\":\"SOON\",\"discountType\":\"PERCENT\",\"discountValue\":5,\"startsOn\":\"" + today.plusDays(3) + "\"}");
        createCode(token, hotel, "{\"code\":\"PAUSED\",\"discountType\":\"PERCENT\",\"discountValue\":5}");
        UUID paused = jdbc.queryForObject("SELECT id FROM promotion_code WHERE hotel_id=? AND code='PAUSED'", UUID.class, hotel);
        mvc.perform(as(token, patch("/api/v1/manager/hotels/" + hotel + "/promotions/" + paused).param("active", "false"))).andExpect(status().isOk());

        assertTrue(reason(() -> reservations.create(guest, stay(hotel, room(hotel), 1, "OLDSALE"))).startsWith("This code expired on"));
        assertTrue(reason(() -> reservations.create(guest, stay(hotel, room(hotel), 1, "SOON"))).startsWith("This code can be used from"));
        assertEquals("This code isn’t valid at this hotel", reason(() -> reservations.create(guest, stay(hotel, room(hotel), 1, "PAUSED"))));
        assertEquals("This code isn’t valid at this hotel", reason(() -> reservations.create(guest, stay(other, room(other), 1, "SOON"))));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM reservation WHERE guest_id=?", Integer.class, guest), "a rejected code books nothing");

        // Another hotel's manager cannot create or change this hotel's codes.
        String stranger = manager(other);
        mvc.perform(as(stranger, post("/api/v1/manager/hotels/" + hotel + "/promotions")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"HIJACK\",\"discountType\":\"PERCENT\",\"discountValue\":100}")).andExpect(status().isForbidden());
        mvc.perform(as(stranger, patch("/api/v1/manager/hotels/" + other + "/promotions/" + paused).param("active", "true"))).andExpect(status().isNotFound());
        mvc.perform(as(stranger, get("/api/v1/manager/hotels/" + hotel + "/promotions"))).andExpect(status().isForbidden());
    }

    @Test void adminPromotionsWorkAtEveryHotelAndAreAdvertisedOnlyWhileFeaturedAndInDate() throws Exception {
        UUID hotelA = approvedHotel(), hotelB = approvedHotel(), guest = guest(), admin = guest();
        jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?,'SYSTEM_ADMIN')", admin);
        String adminToken = tokenFor(admin), managerA = manager(hotelA);
        String code = "FEST" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Phnom_Penh"));

        mvc.perform(as(managerA, post("/api/v1/admin/promotions")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"" + code + "\",\"discountType\":\"PERCENT\",\"discountValue\":20}")).andExpect(status().isForbidden());
        mvc.perform(as(adminToken, post("/api/v1/admin/promotions")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"" + code + "\",\"headline\":\"Water Festival: 20% off\",\"theme\":\"WATER_FESTIVAL\",\"featured\":true,\"discountType\":\"PERCENT\",\"discountValue\":20,\"endsOn\":\"" + today.plusDays(10) + "\",\"onePerGuest\":false}"))
            .andExpect(status().isCreated());
        // A scheduled offer is not advertised before its window opens.
        String later = code.replace("FEST", "LATE");
        mvc.perform(as(adminToken, post("/api/v1/admin/promotions")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"" + later + "\",\"featured\":true,\"discountType\":\"PERCENT\",\"discountValue\":5,\"startsOn\":\"" + today.plusDays(30) + "\"}")).andExpect(status().isCreated());

        mvc.perform(get("/api/v1/promotions/featured")).andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.code=='" + code + "')].headline").value(org.hamcrest.Matchers.contains("Water Festival: 20% off")))
            .andExpect(jsonPath("$[?(@.code=='" + later + "')]").isEmpty());

        // Valid at both hotels; hotel managers don't see platform codes in their own list.
        assertEquals(0, new BigDecimal("80.00").compareTo(reservations.create(guest, stay(hotelA, room(hotelA), 2, code)).total()));
        assertEquals(0, new BigDecimal("40.00").compareTo(reservations.create(guest, stay(hotelB, room(hotelB), 1, code)).total()));
        mvc.perform(as(managerA, get("/api/v1/manager/hotels/" + hotelA + "/promotions"))).andExpect(jsonPath("$[?(@.code=='" + code + "')]").isEmpty());

        // The hotel's own code with the same name takes precedence there.
        createCode(managerA, hotelA, "{\"code\":\"" + code + "\",\"discountType\":\"PERCENT\",\"discountValue\":50,\"onePerGuest\":false}");
        assertEquals(0, new BigDecimal("50.00").compareTo(reservations.create(guest, stay(hotelA, room(hotelA), 2, code)).total()));

        // Unfeaturing hides the advert but the code keeps working; pausing stops it.
        UUID id = jdbc.queryForObject("SELECT id FROM promotion_code WHERE hotel_id IS NULL AND code=?", UUID.class, code);
        mvc.perform(as(adminToken, patch("/api/v1/admin/promotions/" + id).param("featured", "false"))).andExpect(status().isOk()).andExpect(jsonPath("$.featured").value(false));
        mvc.perform(get("/api/v1/promotions/featured")).andExpect(jsonPath("$[?(@.code=='" + code + "')]").isEmpty());
        assertNotNull(reservations.create(guest, stay(hotelB, room(hotelB), 1, code)));
        mvc.perform(as(adminToken, patch("/api/v1/admin/promotions/" + id).param("active", "false"))).andExpect(status().isOk());
        assertEquals("This code isn’t valid at this hotel", reason(() -> reservations.create(guest, stay(hotelB, room(hotelB), 1, code))));
        // Managers cannot feature a hotel code on the home page.
        assertTrue(reason(() -> new com.stayease.promotion.service.PromotionService(jdbc).update(hotelA, UUID.randomUUID(), admin, null, true)).contains("Only platform promotions"));
    }

    @Test void guestsCanCheckACodeBeforeBookingAndManagersSeeUsage() throws Exception {
        UUID hotel = approvedHotel(), guest = guest();
        String slug = jdbc.queryForObject("SELECT slug FROM hotel WHERE id=?", String.class, hotel), token = manager(hotel);
        createCode(token, hotel, "{\"code\":\"KEP15\",\"description\":\"Kep weekend\",\"discountType\":\"PERCENT\",\"discountValue\":15,\"minNights\":2}");

        mvc.perform(get("/api/v1/hotels/" + slug + "/promotions/kep15").param("checkIn", checkIn.toString()).param("checkOut", checkIn.plusDays(2).toString()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.code").value("KEP15")).andExpect(jsonPath("$.discountValue").value(15.0)).andExpect(jsonPath("$.description").value("Kep weekend"));
        mvc.perform(get("/api/v1/hotels/" + slug + "/promotions/kep15").param("checkIn", checkIn.toString()).param("checkOut", checkIn.plusDays(1).toString()))
            .andExpect(status().isBadRequest()).andExpect(jsonPath("$.detail").value("This code needs a stay of at least 2 nights"));
        mvc.perform(get("/api/v1/hotels/" + slug + "/promotions/NOPE")).andExpect(status().isBadRequest());

        reservations.create(guest, stay(hotel, room(hotel), 2, "KEP15"));
        mvc.perform(as(tokenFor(guest), get("/api/v1/hotels/" + slug + "/promotions/KEP15"))).andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("You’ve already used this code"));
        mvc.perform(as(token, get("/api/v1/manager/hotels/" + hotel + "/promotions"))).andExpect(status().isOk())
            .andExpect(jsonPath("$[0].code").value("KEP15")).andExpect(jsonPath("$[0].uses").value(1)).andExpect(jsonPath("$[0].discountGiven").value(15.0));
        mvc.perform(as(token, post("/api/v1/manager/hotels/" + hotel + "/promotions")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"kep15\",\"discountType\":\"PERCENT\",\"discountValue\":5}")).andExpect(status().isConflict());
        mvc.perform(as(token, post("/api/v1/manager/hotels/" + hotel + "/promotions")).contentType(MediaType.APPLICATION_JSON)
            .content("{\"code\":\"TOOMUCH\",\"discountType\":\"PERCENT\",\"discountValue\":150}")).andExpect(status().isBadRequest());
    }
}
