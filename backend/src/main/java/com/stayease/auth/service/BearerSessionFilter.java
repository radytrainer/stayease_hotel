package com.stayease.auth.service;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

@Component
public class BearerSessionFilter extends OncePerRequestFilter {
    private final JdbcTemplate jdbc;
    public BearerSessionFilter(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            String token = header.substring(7).trim();
            if (token.length() >= 40 && token.length() <= 200) {
                String hash = hash(token);
                var matches = jdbc.query("SELECT s.user_id FROM auth_session s JOIN app_user u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>now() AND u.enabled", (rs, row) -> rs.getObject(1, UUID.class), hash);
                if (!matches.isEmpty()) {
                    UUID userId = matches.getFirst();
                    var roles = jdbc.query("SELECT role FROM user_role WHERE user_id=?", (rs, row) -> new SimpleGrantedAuthority("ROLE_" + rs.getString(1)), userId);
                    SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(userId, null, roles));
                }
            }
        }
        chain.doFilter(request, response);
    }
    public static String hash(String token) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException("SHA-256 unavailable", e); }
    }
}

