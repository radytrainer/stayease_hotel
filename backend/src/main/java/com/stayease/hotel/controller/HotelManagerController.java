package com.stayease.hotel.controller;

import jakarta.validation.Valid;
import com.stayease.hotel.dto.CancellationPolicyRequest;
import com.stayease.hotel.dto.ManagerRoomRequest;
import com.stayease.hotel.dto.ManagerRoomTypeRequest;
import com.stayease.hotel.dto.PriceRuleRequest;
import com.stayease.hotel.dto.RoomStatusRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.beans.factory.ObjectProvider;
import com.stayease.hotel.storage.HotelImageStorage;
import com.stayease.payment.service.HotelPaymentService;
import com.stayease.promotion.dto.PromotionRequest;
import com.stayease.promotion.service.PromotionService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/manager/hotels/{hotelId}")
@PreAuthorize("hasRole('HOTEL_MANAGER')")
public class HotelManagerController {
    private final JdbcTemplate jdbc;
    private final ObjectProvider<HotelImageStorage> imageStorage;
    private final HotelPaymentService hotelPayments;
    private final PromotionService promotions;
    public HotelManagerController(JdbcTemplate jdbc,ObjectProvider<HotelImageStorage> imageStorage,HotelPaymentService hotelPayments,PromotionService promotions){this.jdbc=jdbc;this.imageStorage=imageStorage;this.hotelPayments=hotelPayments;this.promotions=promotions;}

    @GetMapping("/promotions")
    public List<Map<String,Object>> promotions(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId){requireManager(hotelId,user);return promotions.list(hotelId);}

    @PostMapping("/promotions") @ResponseStatus(HttpStatus.CREATED)
    public Map<String,Object> createPromotion(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@Valid @RequestBody PromotionRequest body){requireManager(hotelId,user);return promotions.create(hotelId,user,body);}

    @PatchMapping("/promotions/{promotionId}")
    public Map<String,Object> promotionActive(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@PathVariable UUID promotionId,@RequestParam boolean active){requireManager(hotelId,user);return promotions.update(hotelId,promotionId,user,active,null);}

    @GetMapping("/payments/outstanding")
    public List<Map<String,Object>> outstandingPayments(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId){requireManager(hotelId,user);return hotelPayments.outstanding(hotelId);}

    @PostMapping("/reservations/{reservationId}/payment-received")
    public Map<String,Object> paymentReceived(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@PathVariable UUID reservationId){requireManager(hotelId,user);return hotelPayments.markReceived(hotelId,reservationId,user);}

    @PostMapping(value="/images",consumes=org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Map<String,Object> uploadHotelImage(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,
            @RequestPart("file") MultipartFile file,@RequestParam(defaultValue="")String altText){
        requireManager(hotelId,user);
        HotelImageStorage storage=imageStorage.getIfAvailable();
        if(storage==null)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Hotel image storage is not configured");
        if(file.isEmpty()||file.getSize()>10L*1024*1024)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose an image smaller than 10 MB");
        String type=validatedImageType(file);
        if(altText.length()>250)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Image description must be 250 characters or fewer");
        UUID id=UUID.randomUUID();String ext=type.equals("image/jpeg")?"jpg":type.substring("image/".length());String key="hotels/"+hotelId+"/"+id+"."+ext;
        try{storage.upload(hotelId,key,file.getBytes(),type);}catch(java.io.IOException e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Could not read the uploaded image");}
        jdbc.update("INSERT INTO hotel_image(id,hotel_id,object_key,alt_text,content_type) VALUES(?,?,?,?,?)",id,hotelId,key,altText.trim(),type);
        audit(user,hotelId,"HOTEL_IMAGE_UPLOADED","HotelImage",id);
        return Map.of("id",id,"altText",altText.trim(),"url","/api/v1/hotels/images/"+id);
    }

    @PutMapping("/location") @Transactional
    public Map<String,Object> location(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@Valid @RequestBody com.stayease.hotel.dto.HotelLocationRequest body){
        requireManager(hotelId,user);
        com.stayease.hotel.service.HotelLocation.validate(body.latitude(),body.longitude());
        jdbc.update("UPDATE hotel SET latitude=?,longitude=?,updated_at=now() WHERE id=?",body.latitude(),body.longitude(),hotelId);
        audit(user,hotelId,"HOTEL_LOCATION_UPDATED","Hotel",hotelId);
        var result=new java.util.HashMap<String,Object>();result.put("latitude",body.latitude());result.put("longitude",body.longitude());
        return result;
    }

    /** category: ROOM (bedroom), BATHROOM, VIEW (from the room) or EXTERIOR (outside of the building). */
    @PostMapping(value="/room-types/{roomTypeId}/images",consumes=org.springframework.http.MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Map<String,Object> uploadRoomTypeImage(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@PathVariable UUID roomTypeId,
            @RequestPart("file") MultipartFile file,@RequestParam String category,@RequestParam(defaultValue="")String altText){
        requireManager(hotelId,user);
        Integer owned=jdbc.queryForObject("SELECT count(*) FROM room_type WHERE id=? AND hotel_id=?",Integer.class,roomTypeId,hotelId);
        if(owned==null||owned==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Room type not found");
        if(!java.util.List.of("ROOM","BATHROOM","VIEW","EXTERIOR").contains(category))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Photo category must be ROOM, BATHROOM, VIEW or EXTERIOR");
        HotelImageStorage storage=imageStorage.getIfAvailable();
        if(storage==null)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Hotel image storage is not configured");
        if(file.isEmpty()||file.getSize()>10L*1024*1024)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Choose an image smaller than 10 MB");
        String type=validatedImageType(file);
        if(altText.length()>250)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Image description must be 250 characters or fewer");
        UUID id=UUID.randomUUID();String ext=type.equals("image/jpeg")?"jpg":type.substring("image/".length());String key="hotels/"+hotelId+"/room-types/"+roomTypeId+"/"+id+"."+ext;
        try{storage.upload(hotelId,key,file.getBytes(),type);}catch(java.io.IOException e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Could not read the uploaded image");}
        Integer next=jdbc.queryForObject("SELECT COALESCE(max(sort_order)+1,0) FROM room_type_image WHERE room_type_id=? AND category=?",Integer.class,roomTypeId,category);
        jdbc.update("INSERT INTO room_type_image(id,room_type_id,object_key,content_type,alt_text,category,sort_order) VALUES(?,?,?,?,?,?,?)",id,roomTypeId,key,type,altText.trim(),category,next);
        audit(user,hotelId,"ROOM_TYPE_IMAGE_UPLOADED","RoomTypeImage",id);
        return Map.of("id",id,"category",category,"altText",altText.trim());
    }

    private String validatedImageType(MultipartFile file){
        try {
            byte[] b=file.getBytes();String supplied=file.getContentType();
            boolean png=b.length>=8&&(b[0]&255)==137&&b[1]==80&&b[2]==78&&b[3]==71&&b[4]==13&&b[5]==10&&b[6]==26&&b[7]==10;
            boolean jpeg=b.length>=3&&(b[0]&255)==255&&(b[1]&255)==216&&(b[2]&255)==255;
            boolean webp=b.length>=12&&b[0]=='R'&&b[1]=='I'&&b[2]=='F'&&b[3]=='F'&&b[8]=='W'&&b[9]=='E'&&b[10]=='B'&&b[11]=='P';
            String detected=png?"image/png":jpeg?"image/jpeg":webp?"image/webp":null;
            if(detected==null||!detected.equalsIgnoreCase(supplied))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Upload a valid PNG, JPEG, or WebP image");
            return detected;
        }catch(java.io.IOException e){throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Could not read the uploaded image");}
    }

    private void requireManager(UUID hotelId,UUID userId){Integer count=jdbc.queryForObject("SELECT count(*) FROM hotel_staff WHERE hotel_id=? AND user_id=? AND staff_role='HOTEL_MANAGER'",Integer.class,hotelId,userId);if(count==null||count==0)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You are not assigned to manage this hotel");}
    private void audit(UUID user,UUID hotel,String action,String type,UUID entity){jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id) VALUES(?,?,?,?,?)",user,hotel,action,type,entity);}

    @GetMapping("/room-types")
    public List<Map<String,Object>> roomTypes(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId){requireManager(hotelId,user);return jdbc.queryForList("SELECT rt.id,rt.name,rt.description,rt.capacity,rt.base_price,rt.currency,rt.active,(SELECT count(*) FROM room_type_image i WHERE i.room_type_id=rt.id) AS photo_count FROM room_type rt WHERE rt.hotel_id=? ORDER BY rt.name",hotelId);}

    @GetMapping("/rooms")
    public List<Map<String,Object>> rooms(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId){requireManager(hotelId,user);return jdbc.queryForList("SELECT r.id,r.room_number,r.floor,r.operational_status,rt.name AS room_type FROM room r JOIN room_type rt ON rt.id=r.room_type_id WHERE r.hotel_id=? ORDER BY r.room_number",hotelId);}

    @PostMapping("/room-types") @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Map<String,Object> createRoomType(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@Valid @RequestBody ManagerRoomTypeRequest body){requireManager(hotelId,user);UUID id=UUID.randomUUID();jdbc.update("INSERT INTO room_type(id,hotel_id,name,description,capacity,base_price,currency) VALUES(?,?,?,?,?,?,?)",id,hotelId,body.name().trim(),body.description(),body.capacity(),body.basePrice(),body.currency());audit(user,hotelId,"ROOM_TYPE_CREATED","RoomType",id);return Map.of("id",id,"name",body.name(),"capacity",body.capacity());}

    @PostMapping("/rooms") @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Map<String,Object> createRoom(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@Valid @RequestBody ManagerRoomRequest body){requireManager(hotelId,user);Integer type=jdbc.queryForObject("SELECT count(*) FROM room_type WHERE id=? AND hotel_id=? AND active",Integer.class,body.roomTypeId(),hotelId);if(type==null||type==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Room type not found");UUID id=UUID.randomUUID();jdbc.update("INSERT INTO room(id,hotel_id,room_type_id,room_number,floor) VALUES(?,?,?,?,?)",id,hotelId,body.roomTypeId(),body.roomNumber().trim(),body.floor());audit(user,hotelId,"ROOM_CREATED","Room",id);return Map.of("id",id,"roomNumber",body.roomNumber());}

    @PostMapping("/room-types/{roomTypeId}/pricing-rules") @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Map<String,Object> price(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@PathVariable UUID roomTypeId,@Valid @RequestBody PriceRuleRequest body){requireManager(hotelId,user);if(!body.endsOn().isAfter(body.startsOn()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Pricing end date must be after its start date");var types=jdbc.query("SELECT currency FROM room_type WHERE id=? AND hotel_id=?",(rs,n)->rs.getString(1).trim(),roomTypeId,hotelId);if(types.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Room type not found");if(!types.getFirst().equals(body.currency()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Pricing rule currency must match the room type");UUID id=UUID.randomUUID();jdbc.update("INSERT INTO pricing_rule(id,room_type_id,starts_on,ends_on,nightly_price,currency,priority) VALUES(?,?,?,?,?,?,?)",id,roomTypeId,body.startsOn(),body.endsOn(),body.nightlyPrice(),body.currency(),body.priority());audit(user,hotelId,"PRICING_RULE_CREATED","PricingRule",id);return Map.of("id",id,"startsOn",body.startsOn(),"endsOn",body.endsOn());}

    @PatchMapping("/rooms/{roomId}/status") @Transactional
    public Map<String,Object> roomStatus(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@PathVariable UUID roomId,@Valid @RequestBody RoomStatusRequest body){requireManager(hotelId,user);if(!List.of("AVAILABLE","OUT_OF_SERVICE","CLEANING").contains(body.status()))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Unknown room status");int count=jdbc.update("UPDATE room SET operational_status=? WHERE id=? AND hotel_id=?",body.status(),roomId,hotelId);if(count==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Room not found");audit(user,hotelId,"ROOM_STATUS_CHANGED","Room",roomId);return Map.of("id",roomId,"status",body.status());}

    @PostMapping("/cancellation-policies") @ResponseStatus(HttpStatus.CREATED) @Transactional
    public Map<String,Object> cancellationPolicy(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@Valid @RequestBody CancellationPolicyRequest body){requireManager(hotelId,user);jdbc.update("UPDATE cancellation_policy SET active=false WHERE hotel_id=? AND active",hotelId);UUID id=UUID.randomUUID();jdbc.update("INSERT INTO cancellation_policy(id,hotel_id,name,free_cancel_hours,refund_percent,active) VALUES(?,?,?,?,?,true)",id,hotelId,body.name().trim(),body.freeCancelHours(),body.refundPercent());audit(user,hotelId,"CANCELLATION_POLICY_CREATED","CancellationPolicy",id);return Map.of("id",id,"name",body.name(),"active",true);}

    @GetMapping("/reports/overview")
    public Map<String,Object> overview(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@RequestParam LocalDate from,@RequestParam LocalDate to){
        requireManager(hotelId,user);if(!to.isAfter(from)||java.time.temporal.ChronoUnit.DAYS.between(from,to)>366)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Select a report period of up to 366 days");
        Integer rooms=jdbc.queryForObject("SELECT count(*) FROM room WHERE hotel_id=?",Integer.class,hotelId);
        Integer reservations=jdbc.queryForObject("SELECT count(*) FROM reservation WHERE hotel_id=? AND check_in<? AND check_out>? AND status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT','COMPLETED')",Integer.class,hotelId,to,from);
        Integer cancelled=jdbc.queryForObject("SELECT count(*) FROM reservation WHERE hotel_id=? AND check_in>=? AND check_in<? AND status='CANCELLED'",Integer.class,hotelId,from,to);
        BigDecimal revenue=jdbc.queryForObject("SELECT COALESCE(sum(p.amount-COALESCE((SELECT sum(rf.amount) FROM refund rf WHERE rf.payment_id=p.id AND rf.status='SUCCEEDED'),0)),0) FROM payment p JOIN reservation r ON r.id=p.reservation_id WHERE r.hotel_id=? AND r.check_in>=? AND r.check_in<? AND p.status IN ('SUCCEEDED','REFUNDED')",BigDecimal.class,hotelId,from,to);
        Integer occupiedNights=jdbc.queryForObject("SELECT COALESCE(sum(GREATEST(0,LEAST(upper(o.stay),?::date)-GREATEST(lower(o.stay),?::date))),0) FROM room_occupancy o JOIN room r ON r.id=o.room_id JOIN reservation_room rr ON rr.id=o.reservation_room_id JOIN reservation b ON b.id=rr.reservation_id WHERE r.hotel_id=? AND o.active AND b.status IN ('CONFIRMED','CHECKED_IN','CHECKED_OUT','COMPLETED') AND o.stay && daterange(?::date,?::date,'[)')",Integer.class,to,from,hotelId,from,to);
        double occupancy=rooms==null||rooms==0?0.0:(occupiedNights==null?0.0:occupiedNights*100.0/(rooms*java.time.temporal.ChronoUnit.DAYS.between(from,to)));
        return Map.of("from",from,"to",to,"roomCount",rooms==null?0:rooms,"occupancyPercent",BigDecimal.valueOf(occupancy).setScale(2,java.math.RoundingMode.HALF_UP),"reservations",reservations==null?0:reservations,"cancellations",cancelled==null?0:cancelled,"netRevenue",revenue==null?BigDecimal.ZERO:revenue);
    }
}


