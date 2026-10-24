package com.stayease.auth.dto;

import java.util.List;
import java.util.UUID;

public record UserProfileResponse(UUID id,String email,String fullName,String phone,List<String> roles) {}
