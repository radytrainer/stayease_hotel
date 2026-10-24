package com.stayease.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuthRegistrationRequest(@Email @NotBlank @Size(max=320) String email,
                                      @NotBlank @Size(min=12,max=128) String password,
                                      @NotBlank @Size(max=200) String fullName) {}
