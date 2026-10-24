package com.stayease.hotel.controller;

import jakarta.validation.Valid;
import com.stayease.hotel.dto.HotelRegistrationRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/hotels")
public class HotelRegistrationController {
    /** StayEase operates in Cambodia only; every hotel shares the country's single time zone. */
    static final String COUNTRY="Cambodia", TIMEZONE="Asia/Phnom_Penh";
    private final JdbcTemplate jdbc;
    public HotelRegistrationController(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('GUEST')") @Transactional
    public Map<String,Object> register(@AuthenticationPrincipal UUID manager,@Valid @RequestBody HotelRegistrationRequest request){
        if(!COUNTRY.equalsIgnoreCase(request.country().trim()))throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST,"StayEase currently lists hotels in Cambodia only");
        if(!TIMEZONE.equals(request.timezone().trim()))throw new org.springframework.web.server.ResponseStatusException(HttpStatus.BAD_REQUEST,"Hotels in Cambodia use the Asia/Phnom_Penh time zone");
        com.stayease.hotel.service.HotelLocation.validate(request.latitude(),request.longitude());
        UUID hotel=UUID.randomUUID();String slug=request.name().trim().toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+","-").replaceAll("^-|-$","")+"-"+hotel.toString().substring(0,8);
        jdbc.update("INSERT INTO hotel(id,name,slug,description,address,city,country,timezone,status,latitude,longitude) VALUES(?,?,?,?,?,?,?,?,'PENDING_APPROVAL',?,?)",hotel,request.name().trim(),slug,request.description(),request.address().trim(),request.city().trim(),COUNTRY,TIMEZONE,request.latitude(),request.longitude());
        jdbc.update("INSERT INTO hotel_staff(hotel_id,user_id,staff_role) VALUES(?,?,'HOTEL_MANAGER')",hotel,manager);
        jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?,'HOTEL_MANAGER') ON CONFLICT DO NOTHING",manager);
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id) VALUES(?,?,'HOTEL_REGISTERED','Hotel',?)",manager,hotel,hotel);
        return Map.of("id",hotel,"slug",slug,"status","PENDING_APPROVAL");
    }
}

