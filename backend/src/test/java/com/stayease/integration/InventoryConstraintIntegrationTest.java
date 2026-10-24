package com.stayease.integration;

import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.support.TransactionTemplate;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

/** Writes rows directly, bypassing the application, to prove PostgreSQL itself refuses double-booking. */
class InventoryConstraintIntegrationTest extends PostgresIntegrationTest {
    @Autowired TransactionTemplate tx;

    private final LocalDate base = LocalDate.now().plusDays(40);

    private UUID occupy(UUID guest, UUID hotel, UUID room, LocalDate in, LocalDate out, boolean active) {
        return tx.execute(s -> {
            UUID reservation = UUID.randomUUID(), line = UUID.randomUUID();
            jdbc.update("INSERT INTO reservation(id,guest_id,hotel_id,check_in,check_out,status,currency,total_amount,idempotency_key) VALUES(?,?,?,?,?,'CONFIRMED','USD',?,?)",
                reservation, guest, hotel, in, out, new BigDecimal("100.00"), UUID.randomUUID().toString());
            jdbc.update("INSERT INTO reservation_room(id,reservation_id,room_id,room_type_name,nightly_rates,line_total,currency) VALUES(?,?,?,'Deluxe','[]'::jsonb,?,'USD')", line, reservation, room, new BigDecimal("100.00"));
            jdbc.update("INSERT INTO room_occupancy(reservation_room_id,room_id,stay,active) VALUES(?,?,daterange(?,?,'[)'),?)", line, room, in, out, active);
            return reservation;
        });
    }

    @Test void rejectsOverlappingActiveStaysForTheSameRoom() {
        UUID guest = guest(), hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "100"), "101");
        occupy(guest, hotel, room, base, base.plusDays(3), true);
        var ex = assertThrows(DataIntegrityViolationException.class, () -> occupy(guest(), hotel, room, base.plusDays(2), base.plusDays(5), true));
        assertTrue(ex.getMessage().contains("room_occupancy_no_overlap"), ex.getMessage());
        assertThrows(DataIntegrityViolationException.class, () -> occupy(guest(), hotel, room, base.minusDays(1), base.plusDays(4), true), "enclosing stay");
    }

    @Test void allowsBackToBackStaysBecauseCheckOutDayIsExclusive() {
        UUID guest = guest(), hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "100"), "101");
        occupy(guest, hotel, room, base, base.plusDays(3), true);
        assertDoesNotThrow(() -> occupy(guest(), hotel, room, base.plusDays(3), base.plusDays(5), true));
        assertDoesNotThrow(() -> occupy(guest(), hotel, room, base.minusDays(2), base, true));
    }

    @Test void releasedOccupancyNoLongerBlocksTheRoom() {
        UUID guest = guest(), hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "100"), "101");
        occupy(guest, hotel, room, base, base.plusDays(3), false);
        assertDoesNotThrow(() -> occupy(guest(), hotel, room, base, base.plusDays(3), true));
    }

    @Test void differentRoomsCanShareDates() {
        UUID hotel = approvedHotel(), type = roomType(hotel, "Deluxe", 2, "100");
        occupy(guest(), hotel, room(hotel, type, "101"), base, base.plusDays(3), true);
        assertDoesNotThrow(() -> occupy(guest(), hotel, room(hotel, type, "102"), base, base.plusDays(3), true));
    }

    @Test void rejectsCheckOutOnOrBeforeCheckIn() {
        UUID guest = guest(), hotel = approvedHotel();
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update(
            "INSERT INTO reservation(guest_id,hotel_id,check_in,check_out,status,currency,total_amount,idempotency_key) VALUES(?,?,?,?,'CREATED','USD',0,'k')", guest, hotel, base, base));
    }

    @Test void reservationWithoutAnyRoomLineCannotCommit() {
        UUID guest = guest(), hotel = approvedHotel();
        UUID reservation = UUID.randomUUID();
        var ex = assertThrows(DataAccessException.class, () -> tx.executeWithoutResult(s -> jdbc.update(
            "INSERT INTO reservation(id,guest_id,hotel_id,check_in,check_out,status,currency,total_amount,idempotency_key) VALUES(?,?,?,?,?,'CREATED','USD',0,?)",
            reservation, guest, hotel, base, base.plusDays(1), UUID.randomUUID().toString())));
        assertTrue(ex.getMessage().contains("requires at least one room line"), ex.getMessage());
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM reservation WHERE id=?", Integer.class, reservation));
    }

    @Test void lastRoomLineCannotBeRemovedFromAReservation() {
        UUID hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "100"), "101");
        UUID reservation = occupy(guest(), hotel, room, base, base.plusDays(1), true);
        assertThrows(DataAccessException.class, () -> tx.executeWithoutResult(s -> jdbc.update("DELETE FROM reservation_room WHERE reservation_id=?", reservation)));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM reservation_room WHERE reservation_id=?", Integer.class, reservation));
    }
}
