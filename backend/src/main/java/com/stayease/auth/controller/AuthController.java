package com.stayease.auth.controller;

import jakarta.validation.Valid;
import com.stayease.auth.dto.AuthCredentialsRequest;
import com.stayease.auth.dto.AuthRegistrationRequest;
import com.stayease.auth.dto.AuthSessionResponse;
import com.stayease.auth.dto.ProfileUpdateRequest;
import com.stayease.auth.dto.PasswordChangeRequest;
import com.stayease.auth.dto.UserProfileResponse;
import com.stayease.auth.service.BearerSessionFilter;
import com.stayease.auth.service.LoginRateLimiter;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwords;
    private final LoginRateLimiter limiter;
    private final SecureRandom random = new SecureRandom();
    /** Compared against when an email is unknown so failed sign-ins take the same time either way. */
    private final String unknownAccountHash;
    public AuthController(JdbcTemplate jdbc, PasswordEncoder passwords, LoginRateLimiter limiter) {
        this.jdbc=jdbc; this.passwords=passwords; this.limiter=limiter;
        this.unknownAccountHash=passwords.encode(UUID.randomUUID().toString());
    }

    @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED) @Transactional
    public AuthSessionResponse register(@Valid @RequestBody AuthRegistrationRequest body, HttpServletRequest request) {
        limiter.checkAndRecordRegistration(request.getRemoteAddr());
        String email=body.email().trim().toLowerCase(java.util.Locale.ROOT);
        if (jdbc.queryForObject("SELECT count(*) FROM app_user WHERE email=?", Integer.class, email) > 0)
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        UUID user=UUID.randomUUID();
        jdbc.update("INSERT INTO app_user(id,email,password_hash,full_name) VALUES(?,?,?,?)", user,email,passwords.encode(body.password()),body.fullName().trim());
        jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?, 'GUEST')", user);
        return issue(user);
    }

    @PostMapping("/login")
    public AuthSessionResponse login(@Valid @RequestBody AuthCredentialsRequest body, HttpServletRequest request) {
        String email=body.email().trim().toLowerCase(java.util.Locale.ROOT);
        String client=request.getRemoteAddr();
        limiter.checkLogin(email, client);
        var rows=jdbc.query("SELECT id,password_hash FROM app_user WHERE email=? AND enabled", (rs,n)->new Object[]{rs.getObject(1,UUID.class),rs.getString(2)},email);
        UUID user=rows.isEmpty()?null:(UUID)rows.getFirst()[0];
        boolean valid=passwords.matches(body.password(), user==null?unknownAccountHash:(String)rows.getFirst()[1]);
        if(user==null || !valid) {
            limiter.recordLoginFailure(email, client);
            jdbc.update("INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) VALUES(?,'LOGIN_FAILED','User',?,jsonb_build_object('client',?::text))",user,user,client);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Email or password is incorrect");
        }
        limiter.recordLoginSuccess(email);
        AuthSessionResponse session=issue(user);
        jdbc.update("INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) VALUES(?,'LOGIN_SUCCEEDED','User',?,jsonb_build_object('client',?::text))",user,user,client);
        return session;
    }

    @GetMapping("/me")
    public UserProfileResponse profile(@AuthenticationPrincipal UUID userId) {
        var rows=jdbc.query("SELECT id,email,full_name,phone FROM app_user WHERE id=? AND enabled",
            (rs,n)->new UserProfileResponse(rs.getObject("id",UUID.class),rs.getString("email"),rs.getString("full_name"),rs.getString("phone"),null),userId);
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found");
        var profile=rows.getFirst();
        var roles=jdbc.query("SELECT role FROM user_role WHERE user_id=? ORDER BY role",(r,n)->r.getString(1),userId);
        return new UserProfileResponse(profile.id(),profile.email(),profile.fullName(),profile.phone(),roles);
    }

    @PatchMapping("/me") @Transactional
    public UserProfileResponse updateProfile(@AuthenticationPrincipal UUID userId,@Valid @RequestBody ProfileUpdateRequest body) {
        int changed=jdbc.update("UPDATE app_user SET full_name=?,phone=?,updated_at=now() WHERE id=? AND enabled",
            body.fullName().trim(),body.phone()==null||body.phone().isBlank()?null:body.phone().trim(),userId);
        if(changed==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found");
        jdbc.update("INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) VALUES(?,'PROFILE_UPDATED','User',?,jsonb_build_object('fields',jsonb_build_array('fullName','phone'))) ",userId,userId);
        return profile(userId);
    }

    @PutMapping("/password") @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void changePassword(@AuthenticationPrincipal UUID userId,@Valid @RequestBody PasswordChangeRequest body) {
        var rows=jdbc.query("SELECT password_hash FROM app_user WHERE id=? AND enabled",(rs,n)->rs.getString(1),userId);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found");
        if(!passwords.matches(body.currentPassword(),rows.getFirst()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Current password is incorrect");
        if(passwords.matches(body.newPassword(),rows.getFirst()))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose a password different from your current password");
        jdbc.update("UPDATE app_user SET password_hash=?,updated_at=now() WHERE id=?",passwords.encode(body.newPassword()),userId);
        jdbc.update("UPDATE auth_session SET revoked_at=now() WHERE user_id=? AND revoked_at IS NULL",userId);
        jdbc.update("INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id) VALUES(?,'PASSWORD_CHANGED','User',?)",userId,userId);
    }

    @DeleteMapping("/session") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal UUID userId, HttpServletRequest request) {
        String header=request.getHeader("Authorization");
        if(header!=null && header.startsWith("Bearer ")) jdbc.update("UPDATE auth_session SET revoked_at=now() WHERE user_id=? AND token_hash=? AND revoked_at IS NULL",userId,BearerSessionFilter.hash(header.substring(7).trim()));
    }

    private AuthSessionResponse issue(UUID user) {
        byte[] bytes=new byte[48]; random.nextBytes(bytes);
        String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        OffsetDateTime expires=OffsetDateTime.now().plusHours(12);
        jdbc.update("INSERT INTO auth_session(user_id,token_hash,expires_at) VALUES(?,?,?)",user,BearerSessionFilter.hash(token),expires);
        return new AuthSessionResponse(token,"Bearer",expires);
    }
}

