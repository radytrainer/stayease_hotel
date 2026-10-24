package com.stayease.hotel.controller;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class StaffDirectoryController {
    private final JdbcTemplate jdbc;
    public StaffDirectoryController(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @GetMapping("/api/v1/manager/hotels") @PreAuthorize("hasRole('HOTEL_MANAGER')")
    public List<Map<String,Object>> managerHotels(@AuthenticationPrincipal UUID user){return jdbc.queryForList("SELECT h.id,h.name,h.slug,h.city,h.country,h.status,h.address,h.latitude,h.longitude FROM hotel h JOIN hotel_staff s ON s.hotel_id=h.id WHERE s.user_id=? AND s.staff_role='HOTEL_MANAGER' ORDER BY h.name",user);}
    @GetMapping("/api/v1/reception/hotels") @PreAuthorize("hasRole('RECEPTIONIST')")
    public List<Map<String,Object>> receptionHotels(@AuthenticationPrincipal UUID user){return jdbc.queryForList("SELECT h.id,h.name,h.city,h.country,h.status FROM hotel h JOIN hotel_staff s ON s.hotel_id=h.id WHERE s.user_id=? AND s.staff_role='RECEPTIONIST' ORDER BY h.name",user);}
}

