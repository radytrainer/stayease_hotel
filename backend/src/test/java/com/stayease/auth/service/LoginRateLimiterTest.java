package com.stayease.auth.service;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import static org.junit.jupiter.api.Assertions.*;

class LoginRateLimiterTest {
    private static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-17T10:00:00Z");
        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    private final MutableClock clock = new MutableClock();
    private final LoginRateLimiter limiter = new LoginRateLimiter(clock);

    private void fail(String email, String client, int times) {
        for (int i = 0; i < times; i++) { limiter.checkLogin(email, client); limiter.recordLoginFailure(email, client); }
    }

    @Test void blocksAnAccountAfterRepeatedFailuresRegardlessOfEmailCase() {
        fail("guest@example.com", "10.0.0.1", LoginRateLimiter.MAX_FAILURES_PER_EMAIL);
        var ex = assertThrows(LoginRateLimiter.TooManyAttemptsException.class, () -> limiter.checkLogin(" Guest@Example.COM ", "10.0.0.2"));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatusCode());
        assertEquals(LoginRateLimiter.WINDOW.toSeconds(), ex.retryAfterSeconds());
    }

    @Test void releasesTheBlockOnceTheWindowSlidesPast() {
        fail("guest@example.com", "10.0.0.1", LoginRateLimiter.MAX_FAILURES_PER_EMAIL);
        clock.now = clock.now.plus(LoginRateLimiter.WINDOW).plusSeconds(1);
        assertDoesNotThrow(() -> limiter.checkLogin("guest@example.com", "10.0.0.1"));
    }

    @Test void reportsTimeRemainingUntilTheOldestFailureExpires() {
        fail("guest@example.com", "10.0.0.1", 1);
        clock.now = clock.now.plus(Duration.ofMinutes(10));
        fail("guest@example.com", "10.0.0.1", LoginRateLimiter.MAX_FAILURES_PER_EMAIL - 1);
        var ex = assertThrows(LoginRateLimiter.TooManyAttemptsException.class, () -> limiter.checkLogin("guest@example.com", "10.0.0.1"));
        assertEquals(Duration.ofMinutes(5).toSeconds(), ex.retryAfterSeconds());
        assertTrue(ex.getReason().contains("5 minutes"));
    }

    @Test void successfulSignInClearsTheAccountCounter() {
        fail("guest@example.com", "10.0.0.1", LoginRateLimiter.MAX_FAILURES_PER_EMAIL - 1);
        limiter.recordLoginSuccess("guest@example.com");
        fail("guest@example.com", "10.0.0.1", LoginRateLimiter.MAX_FAILURES_PER_EMAIL - 1);
        assertDoesNotThrow(() -> limiter.checkLogin("guest@example.com", "10.0.0.1"));
    }

    @Test void blocksOneClientSprayingManyAccounts() {
        for (int i = 0; i < LoginRateLimiter.MAX_FAILURES_PER_CLIENT; i++) fail("user" + i + "@example.com", "203.0.113.9", 1);
        assertThrows(LoginRateLimiter.TooManyAttemptsException.class, () -> limiter.checkLogin("fresh@example.com", "203.0.113.9"));
        assertDoesNotThrow(() -> limiter.checkLogin("fresh@example.com", "203.0.113.10"));
    }

    @Test void limitsRegistrationsPerClient() {
        for (int i = 0; i < LoginRateLimiter.MAX_REGISTRATIONS_PER_CLIENT; i++) limiter.checkAndRecordRegistration("198.51.100.1");
        assertThrows(LoginRateLimiter.TooManyAttemptsException.class, () -> limiter.checkAndRecordRegistration("198.51.100.1"));
        assertDoesNotThrow(() -> limiter.checkAndRecordRegistration("198.51.100.2"));
    }
}
