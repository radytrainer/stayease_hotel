package com.stayease.hotel.service;

import com.stayease.hotel.entity.HotelEntity;
import com.stayease.hotel.repository.HotelRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class HotelQueryService {
    private final JdbcTemplate jdbc;private final HotelRepository hotels;
    public HotelQueryService(JdbcTemplate jdbc,HotelRepository hotels){this.jdbc=jdbc;this.hotels=hotels;}

    public static final int MAX_PAGE_SIZE=100;

    public List<Map<String,Object>> search(String city,LocalDate checkIn,LocalDate checkOut,Integer guests){
        return search(city,checkIn,checkOut,guests,"name",0,MAX_PAGE_SIZE);
    }

    /** One page of approved hotels, optionally only those with a free room for the dates. */
    public List<Map<String,Object>> search(String city,LocalDate checkIn,LocalDate checkOut,Integer guests,String sort,int page,int size){
        if(page<0||size<1||size>MAX_PAGE_SIZE)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Page size must be between 1 and "+MAX_PAGE_SIZE);
        String order=switch(sort==null?"name":sort){
            case "name"->"h.name";
            case "price_asc"->"\"fromPrice\" ASC NULLS LAST,h.name";
            case "price_desc"->"\"fromPrice\" DESC NULLS LAST,h.name";
            default->throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Sort must be name, price_asc or price_desc");
        };
        if((checkIn==null)!=(checkOut==null)||(checkIn!=null&&(!checkOut.isAfter(checkIn)||ChronoUnit.DAYS.between(checkIn,checkOut)>60)))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Provide valid dates for a stay of up to 60 nights");
        if(guests==null||guests<1||guests>20)throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Guests must be between 1 and 20");
        city=city==null||city.isBlank()?null:"%"+city.trim().toLowerCase(Locale.ROOT)+"%";
        String availability=checkIn==null?"":" AND EXISTS (SELECT 1 FROM room r JOIN room_type rt ON rt.id=r.room_type_id WHERE r.hotel_id=h.id AND r.operational_status='AVAILABLE' AND rt.active AND rt.capacity >= ? AND NOT EXISTS (SELECT 1 FROM room_occupancy o WHERE o.room_id=r.id AND o.active AND o.stay && daterange(?::date,?::date,'[)')))";
        String sql="SELECT h.id,h.name,h.slug,h.description,h.address,h.city,h.country,"
            +"(SELECT min(rt.base_price) FROM room_type rt WHERE rt.hotel_id=h.id AND rt.active) AS \"fromPrice\","
            +"(SELECT min(rt.currency) FROM room_type rt WHERE rt.hotel_id=h.id AND rt.active) AS currency,"
            +"(SELECT COALESCE(i.source_url,'/api/v1/hotels/'||h.slug||'/images/'||i.id) FROM hotel_image i WHERE i.hotel_id=h.id ORDER BY i.sort_order,i.id LIMIT 1) AS \"coverImageUrl\","
            +"(SELECT i.credit_name FROM hotel_image i WHERE i.hotel_id=h.id ORDER BY i.sort_order,i.id LIMIT 1) AS \"coverCreditName\","
            +"(SELECT i.credit_url FROM hotel_image i WHERE i.hotel_id=h.id ORDER BY i.sort_order,i.id LIMIT 1) AS \"coverCreditUrl\" "
            +"FROM hotel h WHERE h.status='APPROVED' AND (?::text IS NULL OR lower(h.city) LIKE ?::text)"+availability+" ORDER BY "+order+",h.id LIMIT "+size+" OFFSET "+((long)page*size);
        if(checkIn==null)return jdbc.queryForList(sql,city,city);
        if(checkIn.isBefore(LocalDate.now(java.time.ZoneOffset.UTC)))throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Check-in cannot be in the past");
        return jdbc.queryForList(sql,city,city,guests,checkIn,checkOut);
    }

    /** Locations with at least one approved hotel, busiest first, for browsing by province. */
    public List<Map<String,Object>> destinations(){
        return jdbc.queryForList("SELECT h.city,count(DISTINCT h.id) AS hotels,min(rt.base_price) AS \"fromPrice\",min(rt.currency) AS currency "
            +"FROM hotel h LEFT JOIN room_type rt ON rt.hotel_id=h.id AND rt.active WHERE h.status='APPROVED' GROUP BY h.city ORDER BY hotels DESC,h.city");
    }

    public Map<String,Object> details(String slug){
        var hotel=hotels.findBySlugAndStatus(slug,"APPROVED").orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Hotel not found"));
        var images=jdbc.query("SELECT id,COALESCE(alt_text,'') AS alt_text,source_url,credit_name,credit_url FROM hotel_image WHERE hotel_id=? ORDER BY sort_order,id",
            (rs,n)->photo(rs,"/api/v1/hotels/"+hotel.getSlug()+"/images/"),hotel.getId());
        var result=new java.util.LinkedHashMap<String,Object>(Map.of("id",hotel.getId(),"name",hotel.getName(),"slug",hotel.getSlug(),"description",hotel.getDescription()==null?"":hotel.getDescription(),"address",hotel.getAddress(),"city",hotel.getCity(),"country",hotel.getCountry(),"images",images));
        jdbc.query("SELECT latitude,longitude FROM hotel WHERE id=? AND latitude IS NOT NULL",rs->{result.put("latitude",rs.getBigDecimal(1));result.put("longitude",rs.getBigDecimal(2));},hotel.getId());
        return result;
    }

    public List<Map<String,Object>> availability(String slug,LocalDate checkIn,LocalDate checkOut,Integer guests){
        if(checkIn==null||checkOut==null||guests==null||checkIn.isBefore(LocalDate.now(java.time.ZoneOffset.UTC))||!checkOut.isAfter(checkIn)||ChronoUnit.DAYS.between(checkIn,checkOut)>60||guests<1||guests>20)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Select valid dates (up to 60 nights) and between 1 and 20 guests");
        String sql="SELECT r.id,rt.id AS type_id,rt.name AS type_name,rt.capacity,rt.currency,rt.base_price,rt.description FROM hotel h JOIN room r ON r.hotel_id=h.id JOIN room_type rt ON rt.id=r.room_type_id WHERE h.slug=? AND h.status='APPROVED' AND r.operational_status='AVAILABLE' AND rt.active AND rt.capacity>=? AND NOT EXISTS (SELECT 1 FROM room_occupancy o WHERE o.room_id=r.id AND o.active AND o.stay && daterange(?::date,?::date,'[)')) ORDER BY rt.name,r.room_number";
        var rooms=jdbc.query(sql,(rs,n)->new Object[]{rs.getObject("id",UUID.class),rs.getObject("type_id",UUID.class),rs.getString("type_name"),rs.getInt("capacity"),rs.getString("currency").trim(),rs.getBigDecimal("base_price"),rs.getString("description")},slug,guests,checkIn,checkOut);
        // Guests book a room type; identical rooms are offered once with how many are free. Specific rooms are
        // assigned from roomIds when the hold is created and shown to the guest afterwards.
        var byType=new java.util.LinkedHashMap<UUID,List<Object[]>>();
        for(Object[] room:rooms)byType.computeIfAbsent((UUID)room[1],k->new ArrayList<>()).add(room);
        var result=new ArrayList<Map<String,Object>>();
        for(var group:byType.values()){
            Object[] room=group.getFirst();
            UUID typeId=(UUID)room[1];BigDecimal base=(BigDecimal)room[5],total=BigDecimal.ZERO;var nightly=new ArrayList<Map<String,Object>>();
            for(LocalDate date=checkIn;date.isBefore(checkOut);date=date.plusDays(1)){
                var prices=jdbc.query("SELECT nightly_price,currency FROM pricing_rule WHERE room_type_id=? AND starts_on<=? AND ends_on>? ORDER BY priority DESC,starts_on DESC LIMIT 1",(rs,n)->new Object[]{rs.getBigDecimal(1),rs.getString(2).trim()},typeId,date,date);
                BigDecimal amount=base;if(!prices.isEmpty()){if(!room[4].equals(prices.getFirst()[1]))throw new ResponseStatusException(HttpStatus.CONFLICT,"Pricing currency configuration is inconsistent");amount=(BigDecimal)prices.getFirst()[0];}nightly.add(Map.of("date",date.toString(),"amount",amount));total=total.add(amount);
            }
            var option=new java.util.LinkedHashMap<String,Object>();
            option.put("roomTypeId",typeId);option.put("roomType",room[2]);option.put("description",room[6]);option.put("capacity",room[3]);
            option.put("currency",room[4]);option.put("nightlyRates",nightly);option.put("total",total);
            option.put("photos",jdbc.query("SELECT id,category,COALESCE(alt_text,'') AS alt_text,source_url,credit_name,credit_url FROM room_type_image WHERE room_type_id=? ORDER BY CASE category WHEN 'ROOM' THEN 0 WHEN 'BATHROOM' THEN 1 WHEN 'VIEW' THEN 2 ELSE 3 END,sort_order",
                (rs,n)->{var photo=photo(rs,"/api/v1/hotels/"+slug+"/room-images/");photo.put("category",rs.getString("category"));return photo;},typeId));
            option.put("available",group.size());option.put("roomIds",group.stream().map(r->r[0]).toList());
            result.add(option);
        }
        return result;
    }

    /** A photo is either stored by us (served from our API) or hotlinked from Unsplash with its credit. */
    private static Map<String,Object> photo(java.sql.ResultSet rs,String localPrefix) throws java.sql.SQLException {
        var photo=new java.util.LinkedHashMap<String,Object>();
        String external=rs.getString("source_url");
        photo.put("id",rs.getObject("id"));photo.put("altText",rs.getString("alt_text"));
        photo.put("url",external!=null?external:localPrefix+rs.getObject("id"));
        if(rs.getString("credit_name")!=null){photo.put("creditName",rs.getString("credit_name"));photo.put("creditUrl",rs.getString("credit_url"));}
        return photo;
    }
}
