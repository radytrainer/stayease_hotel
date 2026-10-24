package com.stayease.hotel.dto;

import jakarta.validation.constraints.NotBlank;

public record RoomStatusRequest(@NotBlank String status) {}
