package com.stayease.integration;

import com.stayease.auth.service.BearerSessionFilter;
import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.service.ReservationService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Exercises the real HTTP stack (bearer filter, URL rules, method security, controller ownership checks) with
 * sessions issued the same way login does, so a missing hotel_id or guest_id filter shows up as a leaked response.
 */
@AutoConfigureMockMvc
class HttpAccessControlIntegrationTest extends PostgresIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ReservationService reservations;

    private final LocalDate checkIn = LocalDate.now().plusDays(90);

    private String session(UUID user, OffsetDateTime expires) {
        String token = UUID.randomUUID() + "-" + UUID.randomUUID();
        jdbc.update("INSERT INTO auth_session(user_id,token_hash,expires_at) VALUES(?,?,?)", user, BearerSessionFilter.hash(token), expires);
        return token;
    }
    private String tokenFor(UUID user) { return session(user, OffsetDateTime.now().plusHours(1)); }

    private UUID userWithRoles(String... roles) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO app_user(id,email,password_hash,full_name) VALUES(?,?,?,?)", id, "user-" + id + "@example.com", "{noop}unused", "Test User");
        for (String role : roles) jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?,?)", id, role);
        return id;
    }
    private UUID staff(UUID hotel, String role) {
        UUID id = userWithRoles("GUEST", role);
        jdbc.update("INSERT INTO hotel_staff(hotel_id,user_id,staff_role) VALUES(?,?,?)", hotel, id, role);
        return id;
    }
    private UUID heldReservation(UUID guest, UUID hotel) {
        UUID type = roomType(hotel, "Standard", 2, "50.00"), room = room(hotel, type, "R-" + UUID.randomUUID().toString().substring(0, 8));
        return reservations.create(guest, new ReservationCreateRequest(hotel, checkIn, checkIn.plusDays(2), 2, List.of(room), UUID.randomUUID().toString())).id();
    }
    private static MockHttpServletRequestBuilder as(String token, MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + token);
    }

    @Test void publicCatalogueIsOpenButEverythingElseNeedsASession() throws Exception {
        mvc.perform(get("/api/v1/hotels")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/hotels/destinations")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/health")).andExpect(status().isOk());

        for (String path : List.of("/api/v1/reservations", "/api/v1/notifications", "/api/v1/auth/me", "/api/v1/admin/users", "/api/v1/manager/hotels", "/api/v1/reception/hotels"))
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
        // Hotel registration sits under the public /hotels prefix; method security must still demand a signed-in guest.
        mvc.perform(post("/api/v1/hotels").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Anonymous Inn\",\"address\":\"1 Street\",\"city\":\"Kampot\",\"country\":\"Cambodia\",\"timezone\":\"Asia/Phnom_Penh\"}"))
            .andExpect(status().isUnauthorized());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM hotel WHERE name='Anonymous Inn'", Integer.class));
    }

    @Test void expiredRevokedDisabledAndUnknownTokensAreTreatedAsSignedOut() throws Exception {
        UUID guest = guest();
        String expired = session(guest, OffsetDateTime.now().minusMinutes(1));
        String revoked = tokenFor(guest);
        jdbc.update("UPDATE auth_session SET revoked_at=now() WHERE token_hash=?", BearerSessionFilter.hash(revoked));
        UUID disabledUser = guest();
        String disabled = tokenFor(disabledUser);
        jdbc.update("UPDATE app_user SET enabled=false WHERE id=?", disabledUser);

        for (String token : List.of(expired, revoked, disabled, "x".repeat(64)))
            mvc.perform(as(token, get("/api/v1/reservations"))).andExpect(status().isUnauthorized());
        mvc.perform(as(tokenFor(guest), get("/api/v1/reservations"))).andExpect(status().isOk());
    }

    @Test void signingOutRevokesOnlyThatSession() throws Exception {
        UUID guest = guest();
        String phone = tokenFor(guest), laptop = tokenFor(guest);
        mvc.perform(as(phone, delete("/api/v1/auth/session"))).andExpect(status().isNoContent());
        mvc.perform(as(phone, get("/api/v1/auth/me"))).andExpect(status().isUnauthorized());
        mvc.perform(as(laptop, get("/api/v1/auth/me"))).andExpect(status().isOk());
    }

    @Test void rolesGateEachConsole() throws Exception {
        UUID hotel = approvedHotel();
        String guest = tokenFor(guest()), manager = tokenFor(staff(hotel, "HOTEL_MANAGER")), receptionist = tokenFor(staff(hotel, "RECEPTIONIST"));
        String admin = tokenFor(userWithRoles("SYSTEM_ADMIN"));

        for (String token : List.of(guest, manager, receptionist)) {
            mvc.perform(as(token, get("/api/v1/admin/users"))).andExpect(status().isForbidden());
            mvc.perform(as(token, patch("/api/v1/admin/hotels/" + hotel + "/status").contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"SUSPENDED\"}"))).andExpect(status().isForbidden());
        }
        mvc.perform(as(admin, get("/api/v1/admin/users"))).andExpect(status().isOk());

        mvc.perform(as(guest, get("/api/v1/manager/hotels/" + hotel + "/rooms"))).andExpect(status().isForbidden());
        mvc.perform(as(receptionist, get("/api/v1/manager/hotels/" + hotel + "/rooms"))).andExpect(status().isForbidden());
        mvc.perform(as(manager, get("/api/v1/manager/hotels/" + hotel + "/rooms"))).andExpect(status().isOk());

        mvc.perform(as(guest, get("/api/v1/reception/hotels/" + hotel + "/arrivals").param("date", checkIn.toString()))).andExpect(status().isForbidden());
        mvc.perform(as(manager, get("/api/v1/reception/hotels/" + hotel + "/arrivals").param("date", checkIn.toString()))).andExpect(status().isForbidden());
        mvc.perform(as(receptionist, get("/api/v1/reception/hotels/" + hotel + "/arrivals").param("date", checkIn.toString()))).andExpect(status().isOk());

        // Staff accounts created by an admin carry no GUEST role, so they cannot book as guests.
        mvc.perform(as(admin, get("/api/v1/reservations"))).andExpect(status().isForbidden());
        // Nobody escalates by editing their own hotel status unless they hold SYSTEM_ADMIN.
        assertStatus(hotel, "APPROVED");
    }

    @Test void managersOnlySeeAndChangeTheirOwnHotels() throws Exception {
        UUID mine = approvedHotel(), theirs = approvedHotel();
        UUID theirType = roomType(theirs, "Suite", 2, "200.00"), theirRoom = room(theirs, theirType, "901");
        String manager = tokenFor(staff(mine, "HOTEL_MANAGER"));
        String base = "/api/v1/manager/hotels/";

        mvc.perform(as(manager, get("/api/v1/manager/hotels"))).andExpect(status().isOk())
            .andExpect(jsonPath("$[*].id", hasItem(mine.toString()))).andExpect(jsonPath("$[*].id", not(hasItem(theirs.toString()))));

        mvc.perform(as(manager, get(base + theirs + "/room-types"))).andExpect(status().isForbidden());
        mvc.perform(as(manager, get(base + theirs + "/rooms"))).andExpect(status().isForbidden());
        mvc.perform(as(manager, get(base + theirs + "/reports/overview").param("from", checkIn.toString()).param("to", checkIn.plusDays(7).toString()))).andExpect(status().isForbidden());
        mvc.perform(as(manager, post(base + theirs + "/room-types").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"Hijack\",\"capacity\":2,\"basePrice\":1,\"currency\":\"USD\"}"))).andExpect(status().isForbidden());
        mvc.perform(as(manager, post(base + theirs + "/cancellation-policies").contentType(MediaType.APPLICATION_JSON)
            .content("{\"name\":\"None\",\"freeCancelHours\":0,\"refundPercent\":0}"))).andExpect(status().isForbidden());
        mvc.perform(as(manager, put(base + theirs + "/location").contentType(MediaType.APPLICATION_JSON)
            .content("{\"latitude\":11.55,\"longitude\":104.92}"))).andExpect(status().isForbidden());

        // Reaching another hotel's rows through my own hotel's URL must not work either.
        mvc.perform(as(manager, patch(base + mine + "/rooms/" + theirRoom + "/status").contentType(MediaType.APPLICATION_JSON)
            .content("{\"status\":\"OUT_OF_SERVICE\"}"))).andExpect(status().isNotFound());
        mvc.perform(as(manager, post(base + mine + "/room-types/" + theirType + "/pricing-rules").contentType(MediaType.APPLICATION_JSON)
            .content("{\"startsOn\":\"" + checkIn + "\",\"endsOn\":\"" + checkIn.plusDays(3) + "\",\"nightlyPrice\":1,\"currency\":\"USD\",\"priority\":99}"))).andExpect(status().isNotFound());
        mvc.perform(as(manager, post(base + mine + "/rooms").contentType(MediaType.APPLICATION_JSON)
            .content("{\"roomTypeId\":\"" + theirType + "\",\"roomNumber\":\"X1\"}"))).andExpect(status().isNotFound());

        assertEquals("AVAILABLE", jdbc.queryForObject("SELECT operational_status FROM room WHERE id=?", String.class, theirRoom));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM pricing_rule WHERE room_type_id=?", Integer.class, theirType));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM room_type WHERE hotel_id=?", Integer.class, theirs));
    }

    @Test void receptionistsOnlyWorkTheirOwnFrontDesk() throws Exception {
        UUID mine = approvedHotel(), theirs = approvedHotel();
        UUID theirBooking = heldReservation(guest(), theirs);
        jdbc.update("UPDATE reservation SET status='CONFIRMED' WHERE id=?", theirBooking);
        String receptionist = tokenFor(staff(mine, "RECEPTIONIST"));
        String base = "/api/v1/reception/hotels/";

        mvc.perform(as(receptionist, get("/api/v1/reception/hotels"))).andExpect(status().isOk())
            .andExpect(jsonPath("$[*].id", hasItem(mine.toString()))).andExpect(jsonPath("$[*].id", not(hasItem(theirs.toString()))));
        mvc.perform(as(receptionist, get(base + theirs + "/arrivals").param("date", checkIn.toString()))).andExpect(status().isForbidden());
        mvc.perform(as(receptionist, post(base + theirs + "/reservations/" + theirBooking + "/check-in"))).andExpect(status().isForbidden());
        mvc.perform(as(receptionist, post(base + mine + "/reservations/" + theirBooking + "/check-in"))).andExpect(status().isNotFound());
        mvc.perform(as(receptionist, post(base + mine + "/reservations/" + theirBooking + "/check-out"))).andExpect(status().isNotFound());
        assertEquals("CONFIRMED", jdbc.queryForObject("SELECT status FROM reservation WHERE id=?", String.class, theirBooking));
    }

    @Test void guestsCannotReadPayForOrCancelSomeoneElsesBooking() throws Exception {
        UUID owner = guest(), hotel = approvedHotel();
        UUID booking = heldReservation(owner, hotel);
        UUID notice = UUID.randomUUID();
        jdbc.update("INSERT INTO notification(id,user_id,reservation_id,channel,template) VALUES(?,?,?,'IN_APP','RESERVATION_HELD')", notice, owner, booking);
        String stranger = tokenFor(guest());

        mvc.perform(as(stranger, get("/api/v1/reservations/" + booking))).andExpect(status().isNotFound());
        mvc.perform(as(stranger, get("/api/v1/reservations/" + booking + "/summary"))).andExpect(status().isNotFound());
        mvc.perform(as(stranger, post("/api/v1/reservations/" + booking + "/checkout"))).andExpect(status().isNotFound());
        mvc.perform(as(stranger, post("/api/v1/reservations/" + booking + "/cancel"))).andExpect(status().isNotFound());
        mvc.perform(as(stranger, patch("/api/v1/notifications/" + notice + "/read"))).andExpect(status().isNotFound());
        mvc.perform(as(stranger, get("/api/v1/reservations"))).andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(0)));
        mvc.perform(as(stranger, get("/api/v1/notifications"))).andExpect(status().isOk()).andExpect(jsonPath("$[*].id", not(hasItem(notice.toString()))));

        assertEquals("PENDING_PAYMENT", jdbc.queryForObject("SELECT status FROM reservation WHERE id=?", String.class, booking));
        assertNull(jdbc.queryForObject("SELECT read_at FROM notification WHERE id=?", OffsetDateTime.class, notice));

        String ownerToken = tokenFor(owner);
        mvc.perform(as(ownerToken, get("/api/v1/reservations/" + booking + "/summary"))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(booking.toString()));
        mvc.perform(as(ownerToken, get("/api/v1/reservations"))).andExpect(status().isOk()).andExpect(jsonPath("$[*].id", hasItem(booking.toString())));
    }

    @Test void disablingAUserEndsTheirExistingSessions() throws Exception {
        UUID target = guest();
        String targetToken = tokenFor(target), admin = tokenFor(userWithRoles("SYSTEM_ADMIN"));
        mvc.perform(as(admin, patch("/api/v1/admin/users/" + target + "/enabled").param("enabled", "false"))).andExpect(status().isOk());
        mvc.perform(as(targetToken, get("/api/v1/auth/me"))).andExpect(status().isUnauthorized());
        mvc.perform(as(admin, patch("/api/v1/admin/users/" + target + "/enabled").param("enabled", "true"))).andExpect(status().isOk());
        // Re-enabling does not resurrect revoked sessions; the user must sign in again.
        mvc.perform(as(targetToken, get("/api/v1/auth/me"))).andExpect(status().isUnauthorized());
    }

    private void assertStatus(UUID hotel, String expected) {
        assertEquals(expected, jdbc.queryForObject("SELECT status FROM hotel WHERE id=?", String.class, hotel));
    }
}
