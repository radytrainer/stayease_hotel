package com.stayease.auth.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window limiter for credential endpoints. Failed sign-ins are counted per email and per client
 * address so that neither a single account nor a single source can be brute-forced. State is per-instance;
 * deployments with several API replicas should also rate limit at the gateway.
 */
@Component
public class LoginRateLimiter {
    static final int MAX_FAILURES_PER_EMAIL = 5;
    static final int MAX_FAILURES_PER_CLIENT = 20;
    static final int MAX_REGISTRATIONS_PER_CLIENT = 10;
    static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int MAX_TRACKED_KEYS = 100_000;

    private final Clock clock;
    private final ConcurrentHashMap<String, Deque<Instant>> events = new ConcurrentHashMap<>();

    public LoginRateLimiter() { this(Clock.systemUTC()); }
    LoginRateLimiter(Clock clock) { this.clock = clock; }

    public void checkLogin(String email, String client) {
        reject(retryAfter("email:" + normalize(email), MAX_FAILURES_PER_EMAIL));
        reject(retryAfter("client:" + client, MAX_FAILURES_PER_CLIENT));
    }

    public void recordLoginFailure(String email, String client) {
        record("email:" + normalize(email));
        record("client:" + client);
    }

    public void recordLoginSuccess(String email) { events.remove("email:" + normalize(email)); }

    public void checkAndRecordRegistration(String client) {
        String key = "register:" + client;
        reject(retryAfter(key, MAX_REGISTRATIONS_PER_CLIENT));
        record(key);
    }

    private Duration retryAfter(String key, int limit) {
        Deque<Instant> window = events.get(key);
        if (window == null) return Duration.ZERO;
        synchronized (window) {
            prune(window);
            if (window.size() < limit) return Duration.ZERO;
            return Duration.between(clock.instant(), window.peekFirst().plus(WINDOW));
        }
    }

    private void record(String key) {
        if (events.size() >= MAX_TRACKED_KEYS) events.values().removeIf(w -> { synchronized (w) { prune(w); return w.isEmpty(); } });
        Deque<Instant> window = events.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (window) { prune(window); window.addLast(clock.instant()); }
    }

    private void prune(Deque<Instant> window) {
        Instant cutoff = clock.instant().minus(WINDOW);
        while (!window.isEmpty() && !window.peekFirst().isAfter(cutoff)) window.removeFirst();
    }

    private static void reject(Duration retryAfter) {
        if (retryAfter.isZero() || retryAfter.isNegative()) return;
        long minutes = Math.max(1, (retryAfter.toSeconds() + 59) / 60);
        throw new TooManyAttemptsException(retryAfter.toSeconds(),
            "Too many attempts. Please wait " + minutes + (minutes == 1 ? " minute" : " minutes") + " and try again");
    }

    private static String normalize(String email) { return email == null ? "" : email.trim().toLowerCase(Locale.ROOT); }

    public static class TooManyAttemptsException extends ResponseStatusException {
        private final long retryAfterSeconds;
        TooManyAttemptsException(long retryAfterSeconds, String reason) { super(HttpStatus.TOO_MANY_REQUESTS, reason); this.retryAfterSeconds = Math.max(1, retryAfterSeconds); }
        public long retryAfterSeconds() { return retryAfterSeconds; }
    }
}
