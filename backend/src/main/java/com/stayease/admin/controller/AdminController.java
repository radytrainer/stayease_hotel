package com.stayease.admin.controller;

import jakarta.validation.Valid;
import com.stayease.admin.dto.AdminHotelStatusRequest;
import com.stayease.admin.dto.AdminStaffAssignmentRequest;
import com.stayease.promotion.dto.PromotionRequest;
import com.stayease.promotion.service.PromotionService;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('SYSTEM_ADMIN')")
public class AdminController {
    private final JdbcTemplate jdbc; private final PromotionService promotions;
    public AdminController(JdbcTemplate jdbc,PromotionService promotions){this.jdbc=jdbc;this.promotions=promotions;}

    /** Platform promotions: valid at every hotel, optionally advertised on the home page during their dates. */
    @GetMapping("/promotions") public List<Map<String,Object>> promotions(){return promotions.list(null);}
    @PostMapping("/promotions") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> createPromotion(@AuthenticationPrincipal UUID admin,@Valid @RequestBody PromotionRequest body){return promotions.create(null,admin,body);}
    @PatchMapping("/promotions/{promotionId}")
    public Map<String,Object> updatePromotion(@AuthenticationPrincipal UUID admin,@PathVariable UUID promotionId,@RequestParam(required=false) Boolean active,@RequestParam(required=false) Boolean featured){
        return promotions.update(null,promotionId,admin,active,featured);
    }

    @GetMapping("/hotels") public List<Map<String,Object>> hotels(@RequestParam(defaultValue="PENDING_APPROVAL")String status){return jdbc.queryForList("SELECT id,name,slug,city,country,status,created_at FROM hotel WHERE status=? ORDER BY created_at",status);}
    @PatchMapping("/hotels/{hotelId}/status") @Transactional
    public Map<String,Object> status(@AuthenticationPrincipal UUID admin,@PathVariable UUID hotelId,@Valid @RequestBody AdminHotelStatusRequest request){
        if(!List.of("APPROVED","SUSPENDED","PENDING_APPROVAL").contains(request.status()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown hotel status");
        int changed=jdbc.update("UPDATE hotel SET status=?,updated_at=now() WHERE id=?",request.status(),hotelId);if(changed==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Hotel not found");
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id,details) VALUES(?,?,'HOTEL_STATUS_CHANGED','Hotel',?,jsonb_build_object('status',?))",admin,hotelId,hotelId,request.status());return Map.of("id",hotelId,"status",request.status());
    }
    @PostMapping("/hotels/{hotelId}/staff") @Transactional
    public Map<String,Object> assignStaff(@AuthenticationPrincipal UUID admin,@PathVariable UUID hotelId,@Valid @RequestBody AdminStaffAssignmentRequest request){
        if(!request.role().equals("RECEPTIONIST")&&!request.role().equals("HOTEL_MANAGER"))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Staff role must be RECEPTIONIST or HOTEL_MANAGER");
        Integer count=jdbc.queryForObject("SELECT count(*) FROM app_user WHERE id=? AND enabled",Integer.class,request.userId());if(count==null||count==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found");
        jdbc.update("INSERT INTO hotel_staff(hotel_id,user_id,staff_role) VALUES(?,?,?) ON CONFLICT(hotel_id,user_id) DO UPDATE SET staff_role=excluded.staff_role",hotelId,request.userId(),request.role());
        jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?,?) ON CONFLICT DO NOTHING",request.userId(),request.role());
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id,details) VALUES(?,?,'HOTEL_STAFF_ASSIGNED','User',?,jsonb_build_object('role',?))",admin,hotelId,request.userId(),request.role());
        return Map.of("hotelId",hotelId,"userId",request.userId(),"role",request.role());
    }
    @GetMapping("/users") public List<Map<String,Object>> users(@RequestParam(defaultValue="50")int limit){return jdbc.queryForList("SELECT id,email,full_name,enabled,created_at FROM app_user ORDER BY created_at DESC LIMIT ?",Math.max(1,Math.min(limit,200)));}
    @PatchMapping("/users/{userId}/enabled") @Transactional
    public Map<String,Object> enabled(@AuthenticationPrincipal UUID admin,@PathVariable UUID userId,@RequestParam boolean enabled){int count=jdbc.update("UPDATE app_user SET enabled=?,updated_at=now() WHERE id=?",enabled,userId);if(count==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"User not found");if(!enabled)jdbc.update("UPDATE auth_session SET revoked_at=now() WHERE user_id=? AND revoked_at IS NULL",userId);jdbc.update("INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,details) VALUES(?,'USER_ENABLED_CHANGED','User',?,jsonb_build_object('enabled',?))",admin,userId,enabled);return Map.of("id",userId,"enabled",enabled);}
}

