package com.stayease.integration;

import com.stayease.hotel.controller.HotelRegistrationController;
import com.stayease.hotel.dto.HotelRegistrationRequest;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.web.server.ResponseStatusException;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@WithMockUser(roles = "GUEST")
class HotelRegistrationIntegrationTest extends PostgresIntegrationTest {
    @Autowired HotelRegistrationController registration;

    private HotelRegistrationRequest request(String city, String country, String timezone) {
        return new HotelRegistrationRequest("Angkor Test Lodge", "Near the temples.", "No. 5, Street 60", city, country, timezone, null, null);
    }
    private HotelRegistrationRequest pinned(String lat, String lng) {
        return new HotelRegistrationRequest("Angkor Test Lodge", null, "No. 5, Street 60", "Siem Reap", "Cambodia", "Asia/Phnom_Penh",
            lat == null ? null : new java.math.BigDecimal(lat), lng == null ? null : new java.math.BigDecimal(lng));
    }

    @Test void storesAMapPinInsideCambodia() {
        UUID hotel = (UUID) registration.register(guest(), pinned("13.362100", "103.860400")).get("id");
        assertEquals(0, new java.math.BigDecimal("13.3621").compareTo(jdbc.queryForObject("SELECT latitude FROM hotel WHERE id=?", java.math.BigDecimal.class, hotel)));
    }

    @Test void rejectsPinsOutsideCambodiaOrMissingHalfThePair() {
        var bangkok = assertThrows(ResponseStatusException.class, () -> registration.register(guest(), pinned("13.7563", "100.5018")));
        assertEquals("The map location must be inside Cambodia", bangkok.getReason());
        var half = assertThrows(ResponseStatusException.class, () -> registration.register(guest(), pinned("13.36", null)));
        assertEquals("Provide both latitude and longitude, or neither", half.getReason());
    }

    @Test void registersACambodianHotelAsPendingWithItsManager() {
        UUID manager = guest();
        var created = registration.register(manager, request("Siem Reap", " cambodia ", "Asia/Phnom_Penh"));
        UUID hotel = (UUID) created.get("id");
        assertEquals("PENDING_APPROVAL", created.get("status"));
        assertEquals("Cambodia", jdbc.queryForObject("SELECT country FROM hotel WHERE id=?", String.class, hotel), "country is stored in canonical form");
        assertEquals("Asia/Phnom_Penh", jdbc.queryForObject("SELECT timezone FROM hotel WHERE id=?", String.class, hotel));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM hotel_staff WHERE hotel_id=? AND user_id=? AND staff_role='HOTEL_MANAGER'", Integer.class, hotel, manager));
    }

    @Test void rejectsHotelsOutsideCambodia() {
        UUID manager = guest();
        var ex = assertThrows(ResponseStatusException.class, () -> registration.register(manager, request("Bangkok", "Thailand", "Asia/Bangkok")));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals("StayEase currently lists hotels in Cambodia only", ex.getReason());
    }

    @Test void rejectsAnyTimeZoneOtherThanCambodias() {
        UUID manager = guest();
        var ex = assertThrows(ResponseStatusException.class, () -> registration.register(manager, request("Kampot", "Cambodia", "Asia/Bangkok")));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM hotel_staff WHERE user_id=?", Integer.class, manager));
    }
}
