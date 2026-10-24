package com.stayease.reservation.dto;

import jakarta.validation.constraints.Size;

public record ReservationCancelRequest(@Size(max=500) String reason) {}
