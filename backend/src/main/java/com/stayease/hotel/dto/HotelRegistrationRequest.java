package com.stayease.hotel.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** latitude/longitude are optional; when given they must be a pair inside Cambodia. */
public record HotelRegistrationRequest(@NotBlank @Size(max=200) String name,
                                       @Size(max=10000) String description,
                                       @NotBlank @Size(max=1000) String address,
                                       @NotBlank @Size(max=120) String city,
                                       @NotBlank @Size(max=120) String country,
                                       @NotBlank @Size(max=80) String timezone,
                                       @Digits(integer=3,fraction=6) BigDecimal latitude,
                                       @Digits(integer=3,fraction=6) BigDecimal longitude) {}
