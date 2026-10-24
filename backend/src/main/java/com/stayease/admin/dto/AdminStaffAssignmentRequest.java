package com.stayease.admin.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;

public record AdminStaffAssignmentRequest(UUID userId,@NotBlank String role) {}
