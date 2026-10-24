package com.stayease.integration;

import com.stayease.hotel.service.HotelQueryService;
import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.service.ReservationService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class HotelSearchIntegrationTest extends PostgresIntegrationTest {
    @Autowired HotelQueryService search;
    @Autowired ReservationService reservations;

    private final LocalDate checkIn = LocalDate.now().plusDays(80);

    private boolean contains(List<Map<String, Object>> results, UUID hotel) {
        return results.stream().anyMatch(r -> hotel.equals(r.get("id")));
    }

    @Test void searchesWithoutACityAndWithoutDates() {
        UUID hotel = approvedHotel();
        roomType(hotel, "Deluxe", 2, "100.00");
        assertTrue(contains(search.search(null, null, null, 1), hotel));
        assertTrue(contains(search.search("  ", null, null, 1), hotel), "blank city is treated as no filter");
    }

    @Test void dateSearchOnlyReturnsHotelsWithAFreeRoomOfEnoughCapacity() {
        UUID hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "100.00"), "101");
        assertTrue(contains(search.search(null, checkIn, checkIn.plusDays(2), 2), hotel));
        assertFalse(contains(search.search(null, checkIn, checkIn.plusDays(2), 3), hotel), "capacity");

        reservations.create(guest(), new ReservationCreateRequest(hotel, checkIn, checkIn.plusDays(2), 1, List.of(room), UUID.randomUUID().toString()));
        assertFalse(contains(search.search(null, checkIn.plusDays(1), checkIn.plusDays(3), 1), hotel), "booked dates");
        assertTrue(contains(search.search(null, checkIn.plusDays(2), checkIn.plusDays(4), 1), hotel), "check-out day is free again");
    }

    @Test void filtersByCityCaseInsensitivelyAndReportsTheLowestBaseRate() {
        UUID hotel = approvedHotel();
        roomType(hotel, "Suite", 4, "250.00");
        roomType(hotel, "Single", 1, "80.50");
        var results = search.search("PHNOM", null, null, 1);
        var row = results.stream().filter(r -> hotel.equals(r.get("id"))).findFirst().orElseThrow();
        assertEquals(0, new BigDecimal("80.50").compareTo((BigDecimal) row.get("fromPrice")));
        assertEquals("USD", String.valueOf(row.get("currency")).trim());
        assertFalse(contains(search.search("Siem Reap", null, null, 1), hotel));
    }

    @Test void hidesHotelsThatAreNotApproved() {
        UUID pending = UUID.randomUUID();
        jdbc.update("INSERT INTO hotel(id,name,slug,address,city,country) VALUES(?,?,?,'x','Phnom Penh','Cambodia')", pending, "Pending " + pending, "pending-" + pending);
        assertFalse(contains(search.search(null, null, null, 1), pending));
    }

    @Test void pagesThroughResultsWithoutGapsOrDuplicatesAndSortsByPrice() {
        String city = "Paging Town " + UUID.randomUUID();
        for (int i = 0; i < 7; i++) {
            UUID hotel = UUID.randomUUID();
            jdbc.update("INSERT INTO hotel(id,name,slug,address,city,country,status) VALUES(?,?,?,'x',?,'Cambodia','APPROVED')", hotel, "Hotel " + i, "paging-" + hotel, city);
            roomType(hotel, "Room", 2, String.valueOf(100 - i * 10));
        }
        var seen = new java.util.ArrayList<Object>();
        for (int page = 0; page < 4; page++) search.search(city, null, null, 1, "name", page, 3).forEach(r -> seen.add(r.get("id")));
        assertEquals(7, seen.size());
        assertEquals(7, new java.util.HashSet<>(seen).size(), "no hotel appears on two pages");

        var cheapest = search.search(city, null, null, 1, "price_asc", 0, 7).stream().map(r -> ((BigDecimal) r.get("fromPrice")).intValue()).toList();
        assertEquals(List.of(40, 50, 60, 70, 80, 90, 100), cheapest);
        assertEquals(100, ((BigDecimal) search.search(city, null, null, 1, "price_desc", 0, 1).getFirst().get("fromPrice")).intValue());
    }

    @Test void rejectsInvalidPagingAndSorting() {
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> search.search(null, null, null, 1, "name", 0, 0));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> search.search(null, null, null, 1, "name", 0, 101));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> search.search(null, null, null, 1, "name", -1, 10));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> search.search(null, null, null, 1, "rating; DROP TABLE hotel", 0, 10));
    }

    @Test void destinationsCountApprovedHotelsPerLocation() {
        String city = "Destination Town " + UUID.randomUUID();
        for (int i = 0; i < 3; i++) {
            UUID hotel = UUID.randomUUID();
            jdbc.update("INSERT INTO hotel(id,name,slug,address,city,country,status) VALUES(?,?,?,'x',?,'Cambodia',?)", hotel, "Hotel " + i, "dest-" + hotel, city, i < 2 ? "APPROVED" : "PENDING_APPROVAL");
            roomType(hotel, "Room", 2, i == 0 ? "35.00" : "20.00");
        }
        var row = search.destinations().stream().filter(d -> city.equals(d.get("city"))).findFirst().orElseThrow();
        assertEquals(2L, ((Number) row.get("hotels")).longValue(), "pending hotels are not counted");
        assertEquals(0, new BigDecimal("20.00").compareTo((BigDecimal) row.get("fromPrice")));
    }
}
