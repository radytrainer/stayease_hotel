package com.stayease.reservation.entity;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

public enum ReservationStatus {
    CREATED, PENDING_PAYMENT, CONFIRMED, CHECKED_IN, CHECKED_OUT, COMPLETED, EXPIRED, CANCELLED;
    private static final Map<ReservationStatus, Set<ReservationStatus>> NEXT = Map.of(
        CREATED, EnumSet.of(PENDING_PAYMENT, EXPIRED, CANCELLED),
        PENDING_PAYMENT, EnumSet.of(CONFIRMED, EXPIRED, CANCELLED),
        CONFIRMED, EnumSet.of(CHECKED_IN, CANCELLED),
        CHECKED_IN, EnumSet.of(CHECKED_OUT),
        CHECKED_OUT, EnumSet.of(COMPLETED),
        COMPLETED, EnumSet.noneOf(ReservationStatus.class),
        EXPIRED, EnumSet.noneOf(ReservationStatus.class),
        CANCELLED, EnumSet.noneOf(ReservationStatus.class));

    public ReservationStatus transitionTo(ReservationStatus target, boolean verifiedPaymentAuthorization) {
        if (!NEXT.get(this).contains(target)) throw new IllegalStateException("Invalid reservation transition: " + this + " to " + target);
        if (target == CONFIRMED && !verifiedPaymentAuthorization) throw new IllegalStateException("Verified payment authorization is required");
        return target;
    }

    /** The guest commits to paying at the front desk: confirmation without an online authorization, from a live hold only. */
    public ReservationStatus confirmForPaymentAtHotel() {
        if (this != PENDING_PAYMENT) throw new IllegalStateException("Only a held reservation can be confirmed for payment at the hotel");
        return CONFIRMED;
    }
}

