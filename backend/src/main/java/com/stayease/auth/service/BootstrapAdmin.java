package com.stayease.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class BootstrapAdmin {
    private final JdbcTemplate jdbc;private final PasswordEncoder encoder;private final String email,password;
    public BootstrapAdmin(JdbcTemplate jdbc,PasswordEncoder encoder,@Value("${app.bootstrap-admin.email:}")String email,@Value("${app.bootstrap-admin.password:}")String password){this.jdbc=jdbc;this.encoder=encoder;this.email=email;this.password=password;}
    @EventListener(ApplicationReadyEvent.class) @Transactional
    public void provisionConfiguredAdmin(){
        if(email.isBlank()&&password.isBlank())return;
        if(email.isBlank()||password.length()<12)throw new IllegalStateException("Set both bootstrap admin email and a password of at least 12 characters");
        String normalized=email.trim().toLowerCase(java.util.Locale.ROOT);
        Integer exists=jdbc.queryForObject("SELECT count(*) FROM app_user WHERE email=?",Integer.class,normalized);
        if(exists!=null&&exists>0)return;
        java.util.UUID id=java.util.UUID.randomUUID();
        jdbc.update("INSERT INTO app_user(id,email,password_hash,full_name) VALUES(?,?,?,?)",id,normalized,encoder.encode(password),"StayEase Administrator");
        jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?,'SYSTEM_ADMIN')",id);
    }
}

