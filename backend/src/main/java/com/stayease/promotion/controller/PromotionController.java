package com.stayease.promotion.controller;

import com.stayease.promotion.service.PromotionService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/** Public promotion endpoints: the home-page advert, and checking a code before reserving (the booking re-checks it). */
@RestController
@RequestMapping("/api/v1")
public class PromotionController {
    private final PromotionService promotions; private final JdbcTemplate jdbc;
    public PromotionController(PromotionService promotions,JdbcTemplate jdbc){this.promotions=promotions;this.jdbc=jdbc;}

    @GetMapping("/promotions/featured")
    public java.util.List<Map<String,Object>> featured(){return promotions.featured();}

    @GetMapping("/hotels/{slug}/promotions/{code}")
    public Map<String,Object> check(@AuthenticationPrincipal UUID guestId,@PathVariable String slug,@PathVariable String code,
            @RequestParam(required=false) LocalDate checkIn,@RequestParam(required=false) LocalDate checkOut){
        UUID hotel=jdbc.query("SELECT id FROM hotel WHERE slug=? AND status='APPROVED'",(rs,n)->rs.getObject(1,UUID.class),slug).stream().findFirst()
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Hotel not found"));
        var p=promotions.check(hotel,code,checkIn,checkOut,guestId,false);
        var result=new LinkedHashMap<String,Object>();
        result.put("code",p.code());result.put("description",p.description());result.put("discountType",p.type());
        result.put("discountValue",p.value());result.put("currency",p.currency());result.put("minNights",p.minNights());
        return result;
    }
}
