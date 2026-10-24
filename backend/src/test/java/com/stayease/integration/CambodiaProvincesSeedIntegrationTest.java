package com.stayease.integration;

import com.stayease.hotel.service.HotelQueryService;
import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.service.ReservationService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import static org.junit.jupiter.api.Assertions.*;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Loads the local demo seed (db/local V900-V902) into its own PostgreSQL container and checks every Cambodian
 * province end to end through the real search, availability, pricing and reservation services.
 * Provinces and capitals follow https://en.wikipedia.org/wiki/Provinces_of_Cambodia.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {"app.scheduling.enabled=false", "spring.flyway.locations=classpath:db/migration,classpath:db/local"})
class CambodiaProvincesSeedIntegrationTest {
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18.6");
    static { POSTGRES.start(); }

    /** The 24 provinces plus the capital, as a guest would type them. */
    static Stream<String> provinces() {
        return Stream.of("Phnom Penh", "Banteay Meanchey", "Battambang", "Kampong Cham", "Kampong Chhnang", "Kampong Speu",
            "Kampong Thom", "Kampot", "Kandal", "Kep", "Koh Kong", "Kratie", "Mondulkiri", "Oddar Meanchey", "Pailin",
            "Preah Sihanouk", "Preah Vihear", "Prey Veng", "Pursat", "Ratanakiri", "Siem Reap", "Stung Treng", "Svay Rieng",
            "Takeo", "Tbong Khmum");
    }

    // Base-rate and high-season stays, both in the future relative to the seed's fixed rule dates.
    private static final LocalDate BASE_IN = LocalDate.now().plusDays(14).isBefore(LocalDate.of(2026, 11, 20)) ? LocalDate.of(2026, 11, 20) : LocalDate.now().plusDays(14);
    private static final LocalDate HIGH_SEASON_IN = LocalDate.of(2027, 1, 10);
    private static final LocalDate NEW_YEAR_IN = LocalDate.of(2027, 4, 14);

    @Autowired HotelQueryService hotels;
    @Autowired ReservationService reservations;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;

    private UUID guest() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO app_user(id,email,password_hash,full_name) VALUES(?,?,?,?)", id, "guest-" + id + "@example.com", "{noop}unused", "Sokha Chan");
        jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?, 'GUEST')", id);
        return id;
    }

    @Test void browsingAProvincePagesThroughEveryOneOfItsHotels() {
        int expected = jdbc.queryForObject("SELECT count(*) FROM hotel WHERE city='Siem Reap'", Integer.class);
        var ids = new java.util.HashSet<Object>();
        for (int page = 0; page * 6 < expected + 6; page++) hotels.search("Siem Reap", null, null, 1, "price_asc", page, 6).forEach(h -> ids.add(h.get("id")));
        assertEquals(expected, ids.size());
        assertTrue(expected >= 10, "Siem Reap is one of the busiest destinations");
    }

    @Test void everyDemoHotelHasAMapPinNearItsProvincialCapital() {
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM hotel WHERE latitude IS NULL", Integer.class), "every demo hotel has a pin");
        // All hotels in a province sit within ~1 km of each other (pins are spread up to ~500 m around the capital).
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM (SELECT city FROM hotel GROUP BY city HAVING max(latitude)-min(latitude)>0.01 OR max(longitude)-min(longitude)>0.01) far", Integer.class));
        var pin = hotels.details("lotus-lantern-residence");
        assertTrue(Math.abs(((BigDecimal) pin.get("latitude")).doubleValue() - 13.3633) < 0.006, "Siem Reap pin near the town centre");
    }

    @Test void everyDemoHotelIsAnApprovedCambodianHotelInCambodiasTimeZone() {
        assertEquals(146, jdbc.queryForObject("SELECT count(*) FROM hotel", Integer.class));
        var destinations = hotels.destinations();
        assertEquals(25, destinations.size(), "every province and the capital has hotels");
        assertEquals(146L, destinations.stream().mapToLong(d -> ((Number) d.get("hotels")).longValue()).sum());
        assertTrue(destinations.stream().allMatch(d -> ((Number) d.get("hotels")).longValue() >= 3), () -> "each province lists several hotels: " + destinations);
        assertEquals("Phnom Penh", destinations.getFirst().get("city"), "busiest destinations first");
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM hotel WHERE country<>'Cambodia' OR timezone<>'Asia/Phnom_Penh' OR status<>'APPROVED'", Integer.class));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM room_type WHERE currency<>'USD'", Integer.class), "Cambodian hotels price in USD");
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM hotel h WHERE NOT EXISTS (SELECT 1 FROM room r WHERE r.hotel_id=h.id AND r.operational_status='AVAILABLE')", Integer.class), "every hotel has bookable rooms");
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM hotel h WHERE NOT EXISTS (SELECT 1 FROM cancellation_policy p WHERE p.hotel_id=h.id AND p.active)", Integer.class), "every hotel has an active cancellation policy");
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM hotel WHERE city ILIKE ANY (ARRAY['%thailand%','%bangkok%','%chiang%','%phuket%'])", Integer.class));
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("provinces")
    void guestCanFindPriceAndBookAStayInEveryProvince(String province) {
        var found = hotels.search(province, BASE_IN, BASE_IN.plusDays(2), 2);
        assertFalse(found.isEmpty(), () -> "no available hotel found for " + province);
        assertTrue(found.stream().allMatch(h -> String.valueOf(h.get("city")).startsWith(province)), () -> "search for " + province + " returned " + found);
        var hotel = found.getFirst();

        List<Map<String, Object>> rooms = hotels.availability(String.valueOf(hotel.get("slug")), BASE_IN, BASE_IN.plusDays(2), 2);
        assertFalse(rooms.isEmpty(), () -> "no rooms for " + province);
        var room = rooms.getFirst();
        assertEquals("USD", String.valueOf(room.get("currency")).trim());

        UUID roomId = UUID.fromString(String.valueOf(((List<?>) room.get("roomIds")).getFirst()));
        var booked = reservations.create(guest(), new ReservationCreateRequest((UUID) hotel.get("id"), BASE_IN, BASE_IN.plusDays(2), 2, List.of(roomId), UUID.randomUUID().toString()));
        assertEquals("PENDING_PAYMENT", booked.status());
        assertEquals(0, ((BigDecimal) room.get("total")).compareTo(booked.total()), "the price quoted in search is the price held");
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("provinces")
    void highSeasonAndKhmerNewYearRatesApplyInEveryProvince(String province) {
        var hotel = hotels.search(province, null, null, 1).getFirst();
        String slug = String.valueOf(hotel.get("slug"));
        var base = hotels.availability(slug, BASE_IN, BASE_IN.plusDays(1), 1);
        var highSeason = hotels.availability(slug, HIGH_SEASON_IN, HIGH_SEASON_IN.plusDays(1), 1);
        var newYear = hotels.availability(slug, NEW_YEAR_IN, NEW_YEAR_IN.plusDays(1), 1);
        assertFalse(base.isEmpty(), () -> "no base-rate rooms for " + province);
        for (var room : base) {
            Object id = room.get("roomTypeId");
            BigDecimal baseRate = (BigDecimal) room.get("total");
            BigDecimal seasonRate = (BigDecimal) highSeason.stream().filter(r -> id.equals(r.get("roomTypeId"))).findFirst().orElseThrow().get("total");
            BigDecimal newYearRate = (BigDecimal) newYear.stream().filter(r -> id.equals(r.get("roomTypeId"))).findFirst().orElseThrow().get("total");
            assertEquals(0, baseRate.multiply(new BigDecimal("1.20")).setScale(0, RoundingMode.HALF_UP).compareTo(seasonRate), () -> province + " high season");
            assertEquals(0, baseRate.multiply(new BigDecimal("1.35")).setScale(0, RoundingMode.HALF_UP).compareTo(newYearRate), () -> province + " Khmer New Year");
        }
    }

    @ParameterizedTest(name = "\"{0}\"")
    @ValueSource(strings = {"Kampong Som", "Sihanoukville", "Sen Monorom", "Banlung", "Stung Sen", "Serei Saophoan", "Chbar Mon", "Ta Khmau", "Samraong", "Doun Kaev", "Suong", "siem reap", "PHNOM PENH"})
    void provincialCapitalsAndLocalNamesFindTheirProvince(String term) {
        var found = hotels.search(term, null, null, 1);
        assertFalse(found.isEmpty(), () -> "search for " + term);
        assertEquals(1, found.stream().map(h -> h.get("city")).distinct().count(), () -> term + " matched more than one province: " + found);
    }

    /** V907: each demo account signs in through the real login endpoint and reaches its own console. */
    @Test void demoAccountsSignInToTheirRoleConsoles() throws Exception {
        String admin = signIn("admin@stayease.local"), manager = signIn("manager@stayease.local");
        String reception = signIn("reception@stayease.local"), guest = signIn("guest@stayease.local");

        mvc.perform(get("/api/v1/admin/users").header("Authorization", "Bearer " + admin)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/manager/hotels").header("Authorization", "Bearer " + manager)).andExpect(status().isOk())
            .andExpect(jsonPath("$[*].name", containsInAnyOrder("Lotus Lantern Residence", "Mekong Riverside Suites")));
        mvc.perform(get("/api/v1/reception/hotels").header("Authorization", "Bearer " + reception)).andExpect(status().isOk())
            .andExpect(jsonPath("$[*].name", contains("Lotus Lantern Residence")));
        mvc.perform(get("/api/v1/reservations").header("Authorization", "Bearer " + guest)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/admin/users").header("Authorization", "Bearer " + guest)).andExpect(status().isForbidden());
    }

    private String signIn(String email) throws Exception {
        String body = mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"StayEase-Demo-2026\"}"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).path("accessToken").asText();
    }
}
