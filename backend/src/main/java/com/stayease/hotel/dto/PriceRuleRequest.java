package com.stayease.hotel.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PriceRuleRequest(@NotNull LocalDate startsOn,@NotNull LocalDate endsOn,
        @NotNull @DecimalMin("0") @Digits(integer=15,fraction=4) BigDecimal nightlyPrice,
        @NotBlank @Pattern(regexp="[A-Z]{3}") String currency,@Min(0) @Max(1000) int priority) {}
