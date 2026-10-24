package com.stayease.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ProfileUpdateRequest(@NotBlank @Size(max=200) String fullName,
                                   @Size(max=40) String phone) {}
