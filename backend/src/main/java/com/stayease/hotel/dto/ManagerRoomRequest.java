package com.stayease.hotel.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;

/** {@code floor} is optional (villas and bungalows have none); 0 is the ground floor. */
public record ManagerRoomRequest(@NotNull UUID roomTypeId,@NotBlank @Size(max=40) String roomNumber,@Min(-5) @Max(200) Integer floor) {}
