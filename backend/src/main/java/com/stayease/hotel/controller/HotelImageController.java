package com.stayease.hotel.controller;

import com.stayease.hotel.storage.HotelImageStorage;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/hotels")
public class HotelImageController {
    private final JdbcTemplate jdbc; private final ObjectProvider<HotelImageStorage> imageStorage;
    public HotelImageController(JdbcTemplate jdbc,ObjectProvider<HotelImageStorage> imageStorage){this.jdbc=jdbc;this.imageStorage=imageStorage;}

    @GetMapping("/{slug}/room-images/{imageId}")
    public ResponseEntity<byte[]> roomImage(@PathVariable String slug,@PathVariable UUID imageId){
        var rows=jdbc.query("SELECT i.object_key,i.content_type FROM room_type_image i JOIN room_type rt ON rt.id=i.room_type_id JOIN hotel h ON h.id=rt.hotel_id WHERE i.id=? AND h.slug=? AND h.status='APPROVED' AND i.object_key IS NOT NULL",(rs,n)->Map.of("key",rs.getString(1),"type",rs.getString(2)),imageId,slug);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Room image not found");
        HotelImageStorage storage=imageStorage.getIfAvailable();
        if(storage==null)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Hotel image storage is not configured");
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String)rows.getFirst().get("type")))
            .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(5)).cachePublic()).body(storage.download((String)rows.getFirst().get("key")));
    }

    @GetMapping("/{slug}/images/{imageId}")
    public ResponseEntity<byte[]> image(@PathVariable String slug,@PathVariable UUID imageId){
        var rows=jdbc.query("SELECT i.object_key,i.content_type FROM hotel_image i JOIN hotel h ON h.id=i.hotel_id WHERE i.id=? AND h.slug=? AND h.status='APPROVED' AND i.object_key IS NOT NULL",(rs,n)->Map.of("key",rs.getString(1),"type",rs.getString(2)),imageId,slug);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Hotel image not found");
        HotelImageStorage storage=imageStorage.getIfAvailable();
        if(storage==null)throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Hotel image storage is not configured");
        byte[] bytes=storage.download((String)rows.getFirst().get("key"));
        return ResponseEntity.ok().contentType(MediaType.parseMediaType((String)rows.getFirst().get("type")))
            .cacheControl(CacheControl.maxAge(java.time.Duration.ofMinutes(5)).cachePublic()).body(bytes);
    }
}

