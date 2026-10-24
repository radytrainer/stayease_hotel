package com.stayease.hotel.dto;

import jakarta.validation.constraints.Digits;
import java.math.BigDecimal;

/** Both null clears the pin. */
public record HotelLocationRequest(@Digits(integer=3,fraction=6) BigDecimal latitude,@Digits(integer=3,fraction=6) BigDecimal longitude) {}
