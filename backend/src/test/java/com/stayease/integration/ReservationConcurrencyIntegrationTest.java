package com.stayease.integration;

import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.dto.ReservationResponse;
import com.stayease.reservation.service.ReservationService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.function.Supplier;
import static org.junit.jupiter.api.Assertions.*;

class ReservationConcurrencyIntegrationTest extends PostgresIntegrationTest {
    private static final int ATTEMPTS = 8;
    @Autowired ReservationService reservations;

    private final LocalDate checkIn = LocalDate.now().plusDays(50);

    private record Outcome(ReservationResponse booked, Throwable failure) {}

    /** Releases every task at once so the attempts genuinely race for the same rows. */
    private List<Outcome> race(List<Supplier<ReservationResponse>> attempts) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(attempts.size());
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Outcome>> futures = new ArrayList<>();
            for (var attempt : attempts) futures.add(pool.submit(() -> {
                start.await();
                try { return new Outcome(attempt.get(), null); } catch (RuntimeException e) { return new Outcome(null, e); }
            }));
            start.countDown();
            List<Outcome> outcomes = new ArrayList<>();
            for (var f : futures) outcomes.add(f.get(60, TimeUnit.SECONDS));
            return outcomes;
        } finally { pool.shutdownNow(); }
    }

    private static boolean isInventoryConflict(Throwable t) {
        return t instanceof DataIntegrityViolationException
            || (t instanceof ResponseStatusException rse && rse.getStatusCode() == HttpStatus.CONFLICT);
    }

    private ReservationCreateRequest request(UUID hotel, LocalDate in, LocalDate out, List<UUID> rooms) {
        return new ReservationCreateRequest(hotel, in, out, 1, rooms, UUID.randomUUID().toString());
    }

    @Test void exactlyOneOfManySimultaneousGuestsGetsTheSameRoomAndDates() throws Exception {
        UUID hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "120.00"), "201");
        List<Supplier<ReservationResponse>> attempts = new ArrayList<>();
        for (int i = 0; i < ATTEMPTS; i++) { UUID g = guest(); attempts.add(() -> reservations.create(g, request(hotel, checkIn, checkIn.plusDays(2), List.of(room)))); }

        var outcomes = race(attempts);

        assertEquals(1, outcomes.stream().filter(o -> o.booked() != null).count(), "winners");
        assertTrue(outcomes.stream().filter(o -> o.failure() != null).allMatch(o -> isInventoryConflict(o.failure())),
            () -> outcomes.stream().filter(o -> o.failure() != null).map(o -> o.failure().toString()).toList().toString());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM room_occupancy WHERE room_id=? AND active", Integer.class, room));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM reservation WHERE hotel_id=?", Integer.class, hotel), "losers leave no partial reservation");
    }

    @Test void overlappingButDifferentDateRangesStillProduceOneWinner() throws Exception {
        UUID hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "120.00"), "201");
        List<Supplier<ReservationResponse>> attempts = new ArrayList<>();
        for (int i = 0; i < ATTEMPTS; i++) {
            UUID g = guest(); LocalDate in = checkIn.plusDays(i % 3);
            attempts.add(() -> reservations.create(g, request(hotel, in, in.plusDays(3), List.of(room))));
        }
        var outcomes = race(attempts);
        assertEquals(1, outcomes.stream().filter(o -> o.booked() != null).count());
    }

    @Test void multiRoomBookingsInOppositeOrderDoNotDeadlockAndNeverSplitInventory() throws Exception {
        for (int round = 0; round < 5; round++) {
            UUID hotel = approvedHotel(), type = roomType(hotel, "Twin", 2, "90.00");
            UUID a = room(hotel, type, "301"), b = room(hotel, type, "302");
            UUID g1 = guest(), g2 = guest();
            var outcomes = race(List.of(
                () -> reservations.create(g1, request(hotel, checkIn, checkIn.plusDays(1), List.of(a, b))),
                () -> reservations.create(g2, request(hotel, checkIn, checkIn.plusDays(1), List.of(b, a)))));
            assertEquals(1, outcomes.stream().filter(o -> o.booked() != null).count(), "round " + round);
            var loser = outcomes.stream().filter(o -> o.failure() != null).findFirst().orElseThrow();
            assertTrue(isInventoryConflict(loser.failure()), loser.failure().toString());
            assertEquals(1, jdbc.queryForObject("SELECT count(DISTINCT rr.reservation_id) FROM reservation_room rr JOIN room_occupancy o ON o.reservation_room_id=rr.id AND o.active WHERE rr.room_id IN (?,?)", Integer.class, a, b),
                "both rooms must belong to the same winning reservation");
        }
    }

    @Test void nonOverlappingRequestsForOneRoomAllSucceed() throws Exception {
        UUID hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "120.00"), "201");
        List<Supplier<ReservationResponse>> attempts = new ArrayList<>();
        for (int i = 0; i < 4; i++) { UUID g = guest(); LocalDate in = checkIn.plusDays(i * 2L); attempts.add(() -> reservations.create(g, request(hotel, in, in.plusDays(2), List.of(room)))); }
        var outcomes = race(attempts);
        assertTrue(outcomes.stream().allMatch(o -> o.booked() != null), () -> outcomes.toString());
    }

    @Test void duplicateSubmissionsWithOneIdempotencyKeyReturnTheSameReservation() throws Exception {
        UUID hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "120.00"), "201");
        UUID guest = guest();
        var same = new ReservationCreateRequest(hotel, checkIn, checkIn.plusDays(2), 1, List.of(room), "double-click-" + UUID.randomUUID());
        List<Supplier<ReservationResponse>> attempts = new ArrayList<>();
        for (int i = 0; i < 4; i++) attempts.add(() -> reservations.create(guest, same));

        var outcomes = race(attempts);

        assertTrue(outcomes.stream().allMatch(o -> o.booked() != null),
            () -> outcomes.stream().filter(o -> o.failure() != null).map(o -> o.failure().toString()).toList().toString());
        assertEquals(1, outcomes.stream().map(o -> o.booked().id()).distinct().count());
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM reservation WHERE guest_id=?", Integer.class, guest));
    }
}
