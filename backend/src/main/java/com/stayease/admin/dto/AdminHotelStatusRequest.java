package com.stayease.admin.dto;

import jakarta.validation.constraints.NotBlank;

public record AdminHotelStatusRequest(@NotBlank String status) {}
