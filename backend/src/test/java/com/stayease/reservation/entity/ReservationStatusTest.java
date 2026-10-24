package com.stayease.reservation.entity;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ReservationStatusTest {
    @Test void requiresPaymentForConfirmation() {
        assertThrows(IllegalStateException.class, () -> ReservationStatus.PENDING_PAYMENT.transitionTo(ReservationStatus.CONFIRMED, false));
        assertEquals(ReservationStatus.CONFIRMED, ReservationStatus.PENDING_PAYMENT.transitionTo(ReservationStatus.CONFIRMED, true));
    }
    @Test void payAtHotelConfirmsOnlyAHeldReservation() {
        assertEquals(ReservationStatus.CONFIRMED, ReservationStatus.PENDING_PAYMENT.confirmForPaymentAtHotel());
        for (ReservationStatus other : new ReservationStatus[]{ReservationStatus.EXPIRED, ReservationStatus.CANCELLED, ReservationStatus.CONFIRMED, ReservationStatus.CREATED})
            assertThrows(IllegalStateException.class, other::confirmForPaymentAtHotel);
    }
    @Test void cancelledReservationsCannotCheckIn() {
        assertThrows(IllegalStateException.class, () -> ReservationStatus.CANCELLED.transitionTo(ReservationStatus.CHECKED_IN, true));
    }
}

