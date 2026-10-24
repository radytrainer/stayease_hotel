package com.stayease.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.service.ReservationHoldExpiry;
import com.stayease.reservation.service.ReservationService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class ReservationLifecycleIntegrationTest extends PostgresIntegrationTest {
    @Autowired ReservationService reservations;
    @Autowired ReservationHoldExpiry holdExpiry;
    @Autowired ObjectMapper json;

    private final LocalDate checkIn = LocalDate.now().plusDays(60);

    private ReservationCreateRequest request(UUID hotel, LocalDate in, LocalDate out, int guests, List<UUID> rooms) {
        return new ReservationCreateRequest(hotel, in, out, guests, rooms, UUID.randomUUID().toString());
    }

    private void priceRule(UUID type, LocalDate from, LocalDate to, String price, int priority) {
        jdbc.update("INSERT INTO pricing_rule(room_type_id,starts_on,ends_on,nightly_price,currency,priority) VALUES(?,?,?,?,'USD',?)", type, from, to, new BigDecimal(price), priority);
    }

    @Test void pricesEachNightFromTheHighestPriorityRuleAndFreezesRatesOnTheRoomLine() throws Exception {
        UUID hotel = approvedHotel(), type = roomType(hotel, "Deluxe", 2, "100.00"), room = room(hotel, type, "101");
        priceRule(type, checkIn.plusDays(1), checkIn.plusDays(3), "150.10", 0);   // season
        priceRule(type, checkIn.plusDays(2), checkIn.plusDays(3), "199.99", 10);  // event night overrides season

        var booked = reservations.create(guest(), request(hotel, checkIn, checkIn.plusDays(4), 2, List.of(room)));

        assertEquals(0, new BigDecimal("550.09").compareTo(booked.total()), "100 + 150.10 + 199.99 + 100 computed in decimal");
        String stored = jdbc.queryForObject("SELECT nightly_rates::text FROM reservation_room WHERE reservation_id=?", String.class, booked.id());
        var amounts = json.readTree(stored).findValues("amount").stream().map(n -> n.decimalValue().stripTrailingZeros().toPlainString()).toList();
        assertEquals(List.of("100", "150.1", "199.99", "100"), amounts);

        jdbc.update("UPDATE room_type SET base_price=999 WHERE id=?", type);
        jdbc.update("UPDATE pricing_rule SET nightly_price=1 WHERE room_type_id=?", type);
        assertEquals(stored, jdbc.queryForObject("SELECT nightly_rates::text FROM reservation_room WHERE reservation_id=?", String.class, booked.id()), "later price changes must not alter booked rates");
        assertEquals(0, new BigDecimal("550.09").compareTo(jdbc.queryForObject("SELECT total_amount FROM reservation WHERE id=?", BigDecimal.class, booked.id())));
    }

    @Test void multiRoomReservationCreatesOneLinePerRoomUnderOneGuest() {
        UUID hotel = approvedHotel(), type = roomType(hotel, "Twin", 2, "80.00");
        UUID a = room(hotel, type, "301"), b = room(hotel, type, "302"), guest = guest();

        var booked = reservations.create(guest, request(hotel, checkIn, checkIn.plusDays(2), 4, List.of(a, b)));

        assertEquals("PENDING_PAYMENT", booked.status());
        assertEquals(0, new BigDecimal("320.00").compareTo(booked.total()));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM reservation_room WHERE reservation_id=?", Integer.class, booked.id()));
        assertEquals(guest, jdbc.queryForObject("SELECT guest_id FROM reservation WHERE id=?", UUID.class, booked.id()));
        assertEquals("PENDING_PAYMENT", jdbc.queryForObject("SELECT to_status FROM reservation_status_history WHERE reservation_id=?", String.class, booked.id()));
    }

    @Test void expiredHoldReleasesInventoryForTheNextGuest() {
        UUID hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "100.00"), "101");
        var first = reservations.create(guest(), request(hotel, checkIn, checkIn.plusDays(2), 1, List.of(room)));
        assertThrows(RuntimeException.class, () -> reservations.create(guest(), request(hotel, checkIn, checkIn.plusDays(2), 1, List.of(room))), "held room is unavailable");

        jdbc.update("UPDATE reservation SET hold_expires_at=now()-interval '1 minute' WHERE id=?", first.id());
        holdExpiry.releaseExpiredHolds();

        assertEquals("EXPIRED", jdbc.queryForObject("SELECT status FROM reservation WHERE id=?", String.class, first.id()));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM reservation_status_history WHERE reservation_id=? AND from_status='PENDING_PAYMENT' AND to_status='EXPIRED'", Integer.class, first.id()));
        var second = reservations.create(guest(), request(hotel, checkIn, checkIn.plusDays(2), 1, List.of(room)));
        assertEquals("PENDING_PAYMENT", second.status());
    }

    @Test void unexpiredHoldsAndConfirmedReservationsAreNotReleased() {
        UUID hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "100.00"), "101");
        var held = reservations.create(guest(), request(hotel, checkIn, checkIn.plusDays(1), 1, List.of(room)));
        holdExpiry.releaseExpiredHolds();
        assertEquals("PENDING_PAYMENT", jdbc.queryForObject("SELECT status FROM reservation WHERE id=?", String.class, held.id()));
        assertTrue(jdbc.queryForObject("SELECT active FROM room_occupancy o JOIN reservation_room rr ON rr.id=o.reservation_room_id WHERE rr.reservation_id=?", Boolean.class, held.id()));
    }

    private HttpStatus statusOf(Runnable call) {
        var ex = assertThrows(ResponseStatusException.class, call::run);
        return HttpStatus.valueOf(ex.getStatusCode().value());
    }

    @Test void rejectsInvalidDatesCapacityAndUnavailableInventory() {
        UUID hotel = approvedHotel(), type = roomType(hotel, "Single", 1, "60.00"), room = room(hotel, type, "101");
        UUID guest = guest();
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> reservations.create(guest, request(hotel, checkIn, checkIn, 1, List.of(room)))), "zero nights");
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> reservations.create(guest, request(hotel, checkIn.plusDays(2), checkIn, 1, List.of(room)))), "reversed dates");
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> reservations.create(guest, request(hotel, LocalDate.now().minusDays(1), LocalDate.now().plusDays(1), 1, List.of(room)))), "past check-in");
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> reservations.create(guest, request(hotel, checkIn, checkIn.plusDays(61), 1, List.of(room)))), "over 60 nights");
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> reservations.create(guest, request(hotel, checkIn, checkIn.plusDays(1), 2, List.of(room)))), "capacity");
        assertEquals(HttpStatus.BAD_REQUEST, statusOf(() -> reservations.create(guest, request(hotel, checkIn, checkIn.plusDays(1), 1, List.of(room, room)))), "duplicate room");

        jdbc.update("UPDATE room SET operational_status='OUT_OF_SERVICE' WHERE id=?", room);
        assertEquals(HttpStatus.CONFLICT, statusOf(() -> reservations.create(guest, request(hotel, checkIn, checkIn.plusDays(1), 1, List.of(room)))), "out of service");

        UUID otherHotel = approvedHotel(), foreignRoom = room(otherHotel, roomType(otherHotel, "Single", 1, "60.00"), "101");
        assertEquals(HttpStatus.CONFLICT, statusOf(() -> reservations.create(guest, request(hotel, checkIn, checkIn.plusDays(1), 1, List.of(foreignRoom)))), "room from another hotel");

        UUID pending = UUID.randomUUID();
        jdbc.update("INSERT INTO hotel(id,name,slug,address,city,country) VALUES(?,?,?,'x','x','x')", pending, "Pending " + pending, "pending-" + pending);
        UUID pendingRoom = room(pending, roomType(pending, "Single", 1, "60.00"), "101");
        assertEquals(HttpStatus.NOT_FOUND, statusOf(() -> reservations.create(guest, request(pending, checkIn, checkIn.plusDays(1), 1, List.of(pendingRoom)))), "unapproved hotel");
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM reservation WHERE guest_id=?", Integer.class, guest));
    }
}
