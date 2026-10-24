package com.stayease.hotel.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record CancellationPolicyRequest(@NotBlank @Size(max=160) String name,@Min(0) @Max(8760) int freeCancelHours,
        @NotNull @DecimalMin("0") @DecimalMax("100") @Digits(integer=3,fraction=2) BigDecimal refundPercent) {}
