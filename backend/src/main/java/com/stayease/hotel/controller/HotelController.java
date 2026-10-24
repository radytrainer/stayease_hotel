package com.stayease.hotel.controller;

import com.stayease.hotel.service.HotelQueryService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/hotels")
public class HotelController {
    private final HotelQueryService hotels;
    public HotelController(HotelQueryService hotels){this.hotels=hotels;}
    @GetMapping public List<Map<String,Object>> search(@RequestParam(required=false)String city,
        @RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate checkIn,
        @RequestParam(required=false)@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate checkOut,
        @RequestParam(required=false,defaultValue="1")Integer guests,
        @RequestParam(defaultValue="name")String sort,
        @RequestParam(defaultValue="0")int page,
        @RequestParam(defaultValue="24")int size){return hotels.search(city,checkIn,checkOut,guests,sort,page,size);}
    @GetMapping("/destinations") public List<Map<String,Object>> destinations(){return hotels.destinations();}
    @GetMapping("/{slug}") public Map<String,Object> details(@PathVariable String slug){return hotels.details(slug);}
    @GetMapping("/{slug}/availability") public List<Map<String,Object>> availability(@PathVariable String slug,
        @RequestParam@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate checkIn,
        @RequestParam@DateTimeFormat(iso=DateTimeFormat.ISO.DATE)LocalDate checkOut,
        @RequestParam(defaultValue="1")Integer guests){return hotels.availability(slug,checkIn,checkOut,guests);}
}

