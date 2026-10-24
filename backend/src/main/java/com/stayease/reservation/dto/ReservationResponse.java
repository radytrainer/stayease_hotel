package com.stayease.reservation.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ReservationResponse(UUID id,String status,LocalDate checkIn,LocalDate checkOut,
                                  String currency,BigDecimal total,OffsetDateTime holdExpiresAt) {}
