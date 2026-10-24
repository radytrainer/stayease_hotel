package com.stayease.hotel.service;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;

/** Hotel map pins: optional, set as a pair, and inside Cambodia (matches the hotel_location_in_cambodia constraint). */
public final class HotelLocation {
    private static final BigDecimal MIN_LAT=new BigDecimal("9.5"),MAX_LAT=new BigDecimal("14.8"),MIN_LNG=new BigDecimal("102.2"),MAX_LNG=new BigDecimal("107.8");
    private HotelLocation(){}

    public static void validate(BigDecimal latitude,BigDecimal longitude){
        if((latitude==null)!=(longitude==null))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Provide both latitude and longitude, or neither");
        if(latitude==null)return;
        if(latitude.compareTo(MIN_LAT)<0||latitude.compareTo(MAX_LAT)>0||longitude.compareTo(MIN_LNG)<0||longitude.compareTo(MAX_LNG)>0)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"The map location must be inside Cambodia");
    }
}
