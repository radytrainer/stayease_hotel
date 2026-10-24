package com.stayease.auth.dto;

import java.time.OffsetDateTime;

public record AuthSessionResponse(String accessToken,String tokenType,OffsetDateTime expiresAt) {}
