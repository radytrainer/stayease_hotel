package com.stayease.hotel.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record ManagerRoomTypeRequest(@NotBlank @Size(max=160) String name,@Size(max=4000) String description,
        @Min(1) @Max(20) int capacity,@NotNull @DecimalMin("0") @Digits(integer=15,fraction=4) BigDecimal basePrice,
        @NotBlank @Pattern(regexp="[A-Z]{3}") String currency) {}
