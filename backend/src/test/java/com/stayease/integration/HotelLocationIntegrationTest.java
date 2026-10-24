package com.stayease.integration;

import com.stayease.hotel.controller.HotelManagerController;
import com.stayease.hotel.dto.HotelLocationRequest;
import com.stayease.hotel.service.HotelQueryService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

@WithMockUser(roles = "HOTEL_MANAGER")
class HotelLocationIntegrationTest extends PostgresIntegrationTest {
    @Autowired HotelManagerController manager;
    @Autowired HotelQueryService hotels;

    private UUID managedHotel(UUID user) {
        UUID hotel = approvedHotel();
        jdbc.update("INSERT INTO hotel_staff(hotel_id,user_id,staff_role) VALUES(?,?,'HOTEL_MANAGER')", hotel, user);
        return hotel;
    }
    private String slug(UUID hotel) { return jdbc.queryForObject("SELECT slug FROM hotel WHERE id=?", String.class, hotel); }

    @Test void managerSetsAndClearsTheMapPinShownToGuests() {
        UUID user = guest(), hotel = managedHotel(user);
        manager.location(user, hotel, new HotelLocationRequest(new BigDecimal("11.556400"), new BigDecimal("104.928200")));
        var details = hotels.details(slug(hotel));
        assertEquals(0, new BigDecimal("11.5564").compareTo((BigDecimal) details.get("latitude")));
        assertEquals(0, new BigDecimal("104.9282").compareTo((BigDecimal) details.get("longitude")));

        manager.location(user, hotel, new HotelLocationRequest(null, null));
        assertFalse(hotels.details(slug(hotel)).containsKey("latitude"), "no pin, no map");
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM audit_log WHERE hotel_id=? AND action='HOTEL_LOCATION_UPDATED'", Integer.class, hotel));
    }

    @Test void rejectsPinsOutsideCambodia() {
        UUID user = guest(), hotel = managedHotel(user);
        var ex = assertThrows(ResponseStatusException.class, () -> manager.location(user, hotel, new HotelLocationRequest(new BigDecimal("13.7563"), new BigDecimal("100.5018"))));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test void onlyTheHotelsOwnManagersCanMoveIt() {
        UUID owner = guest(), other = guest(), hotel = managedHotel(owner);
        var ex = assertThrows(ResponseStatusException.class, () -> manager.location(other, hotel, new HotelLocationRequest(new BigDecimal("11.5"), new BigDecimal("104.9"))));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertNull(jdbc.queryForObject("SELECT latitude FROM hotel WHERE id=?", BigDecimal.class, hotel));
    }

    @Test void databaseRefusesHalfAPinOrOneOutsideCambodia() {
        UUID hotel = approvedHotel();
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> jdbc.update("UPDATE hotel SET latitude=11.5 WHERE id=?", hotel));
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> jdbc.update("UPDATE hotel SET latitude=1.3,longitude=103.8 WHERE id=?", hotel));
    }
}
