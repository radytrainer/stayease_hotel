package com.stayease.auth.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class BearerSessionFilterTest {
    @Test void hashesOpaqueTokensWithoutStoringTheRawValue() {
        String token="random-session-token-that-is-never-stored-as-is";
        String hash=BearerSessionFilter.hash(token);
        assertEquals(64,hash.length());
        assertNotEquals(token,hash);
        assertEquals(hash,BearerSessionFilter.hash(token));
        assertNotEquals(hash,BearerSessionFilter.hash(token+"x"));
    }
}

