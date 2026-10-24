package com.stayease.promotion.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A new discount code. FIXED amounts are in the hotel's room currency (USD for platform promotions).
 * headline, theme and featured apply to administrator (platform) promotions only.
 */
public record PromotionRequest(@NotBlank @Size(max=32) String code,
                               @Size(max=200) String description,
                               @NotBlank @Pattern(regexp="PERCENT|FIXED") String discountType,
                               @NotNull @DecimalMin("0.01") @Digits(integer=15,fraction=2) BigDecimal discountValue,
                               LocalDate startsOn,
                               LocalDate endsOn,
                               @Min(1) @Max(60) Integer minNights,
                               @Min(1) @Max(100000) Integer maxUses,
                               Boolean onePerGuest,
                               @Size(max=80) String headline,
                               @Pattern(regexp="GENERAL|KHMER_NEW_YEAR|PCHUM_BEN|WATER_FESTIVAL|INTERNATIONAL_NEW_YEAR|GREEN_SEASON|HIGH_SEASON") String theme,
                               Boolean featured) {}
