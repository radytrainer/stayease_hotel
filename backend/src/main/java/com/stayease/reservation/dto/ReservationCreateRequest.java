package com.stayease.reservation.dto;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ReservationCreateRequest(@NotNull UUID hotelId,@NotNull LocalDate checkIn,@NotNull LocalDate checkOut,
        @Min(1) @Max(20) int guests,@NotEmpty List<@NotNull UUID> roomIds,
        @NotBlank @Size(max=160) String idempotencyKey,
        @Size(max=32) String promoCode) {
    /** A booking without a discount code. */
    public ReservationCreateRequest(UUID hotelId,LocalDate checkIn,LocalDate checkOut,int guests,List<UUID> roomIds,String idempotencyKey){
        this(hotelId,checkIn,checkOut,guests,roomIds,idempotencyKey,null);
    }
}
