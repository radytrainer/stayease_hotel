package com.stayease.promotion.service;

import com.stayease.promotion.dto.PromotionRequest;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Hotel discount codes. One set of rules serves both the guest's "Apply" check and booking creation, and booking
 * creation re-checks under a row lock so the last use of a limited code cannot be taken twice.
 */
@Service
public class PromotionService {
    private static final DateTimeFormatter DAY=DateTimeFormatter.ofPattern("d MMM yyyy",Locale.ENGLISH);
    /** Statuses that hold a use of the code; expired or cancelled bookings give it back. */
    private static final String LIVE="('PENDING_PAYMENT','CONFIRMED','CHECKED_IN','CHECKED_OUT','COMPLETED')";
    private final JdbcTemplate jdbc;
    public PromotionService(JdbcTemplate jdbc){this.jdbc=jdbc;}

    public record Promotion(UUID id,String code,String description,String type,BigDecimal value,String currency,LocalDate startsOn,LocalDate endsOn,int minNights,Integer maxUses,boolean onePerGuest){}
    public record Applied(Promotion promotion,BigDecimal discount){}

    public static String normalise(String code){return code==null?"":code.trim().toUpperCase(Locale.ROOT);}

    /** Validates a code for a stay. {@code guestId} may be null (signed-out check); {@code lock} is used when booking. */
    public Promotion check(UUID hotelId,String rawCode,LocalDate checkIn,LocalDate checkOut,UUID guestId,boolean lock){
        String code=normalise(rawCode);
        // The hotel's own code wins over a platform code with the same name.
        var rows=jdbc.query("SELECT id,code,description,discount_type,discount_value,currency,starts_on,ends_on,min_nights,max_uses,one_per_guest FROM promotion_code WHERE (hotel_id=? OR hotel_id IS NULL) AND code=? AND active ORDER BY hotel_id NULLS LAST LIMIT 1"+(lock?" FOR UPDATE":""),
            (rs,n)->new Promotion(rs.getObject(1,UUID.class),rs.getString(2),rs.getString(3),rs.getString(4),rs.getBigDecimal(5),rs.getString(6)==null?null:rs.getString(6).trim(),
                rs.getObject(7,LocalDate.class),rs.getObject(8,LocalDate.class),rs.getInt(9),(Integer)rs.getObject(10),rs.getBoolean(11)),hotelId,code);
        if(rows.isEmpty())throw bad("This code isn’t valid at this hotel");
        Promotion p=rows.getFirst();
        LocalDate today=LocalDate.now(ZoneId.of(jdbc.queryForObject("SELECT timezone FROM hotel WHERE id=?",String.class,hotelId)));
        if(p.startsOn()!=null&&today.isBefore(p.startsOn()))throw bad("This code can be used from "+DAY.format(p.startsOn()));
        if(p.endsOn()!=null&&today.isAfter(p.endsOn()))throw bad("This code expired on "+DAY.format(p.endsOn()));
        if(checkIn!=null&&checkOut!=null&&ChronoUnit.DAYS.between(checkIn,checkOut)<p.minNights())
            throw bad("This code needs a stay of at least "+p.minNights()+" nights");
        if(p.onePerGuest()&&guestId!=null){
            Integer mine=jdbc.queryForObject("SELECT count(*) FROM reservation WHERE promotion_code_id=? AND guest_id=? AND status IN "+LIVE,Integer.class,p.id(),guestId);
            if(mine!=null&&mine>0)throw bad("You’ve already used this code");
        }
        if(p.maxUses()!=null&&uses(p.id())>=p.maxUses())throw bad("This code has been fully used");
        return p;
    }

    /** Discount on a subtotal, rounded to cents and never more than the subtotal. */
    public static BigDecimal discount(Promotion p,BigDecimal subtotal,String currency){
        BigDecimal off;
        if("PERCENT".equals(p.type()))off=subtotal.multiply(p.value()).divide(BigDecimal.valueOf(100),2,RoundingMode.HALF_UP);
        else{
            if(!p.currency().equalsIgnoreCase(currency))throw bad("This code can’t be used for prices in "+currency);
            off=p.value();
        }
        return off.min(subtotal).setScale(4,RoundingMode.HALF_UP);
    }

    /** Used inside the booking transaction: locks the code, re-checks every rule, and returns the discount. */
    public Applied applyForBooking(UUID hotelId,String code,LocalDate checkIn,LocalDate checkOut,UUID guestId,BigDecimal subtotal,String currency){
        Promotion p=check(hotelId,code,checkIn,checkOut,guestId,true);
        return new Applied(p,discount(p,subtotal,currency));
    }

    private int uses(UUID promotionId){
        Integer n=jdbc.queryForObject("SELECT count(*) FROM reservation WHERE promotion_code_id=? AND status IN "+LIVE,Integer.class,promotionId);
        return n==null?0:n;
    }

    @Transactional(readOnly=true)
    public List<Map<String,Object>> list(UUID hotelId){
        return jdbc.query("SELECT p.*,(SELECT count(*) FROM reservation r WHERE r.promotion_code_id=p.id AND r.status IN "+LIVE+") AS uses,"
            +"(SELECT COALESCE(sum(r.discount_amount),0) FROM reservation r WHERE r.promotion_code_id=p.id AND r.status IN "+LIVE+") AS discount_given FROM promotion_code p WHERE p.hotel_id IS NOT DISTINCT FROM ?::uuid ORDER BY p.active DESC,p.created_at DESC",
            (rs,n)->{var m=new LinkedHashMap<String,Object>();m.put("id",rs.getObject("id"));m.put("code",rs.getString("code"));m.put("description",rs.getString("description"));
                m.put("headline",rs.getString("headline"));m.put("theme",rs.getString("theme"));m.put("featured",rs.getBoolean("featured"));
                m.put("discountType",rs.getString("discount_type"));m.put("discountValue",rs.getBigDecimal("discount_value"));m.put("currency",rs.getString("currency")==null?null:rs.getString("currency").trim());
                m.put("startsOn",rs.getObject("starts_on",LocalDate.class));m.put("endsOn",rs.getObject("ends_on",LocalDate.class));m.put("minNights",rs.getInt("min_nights"));
                m.put("maxUses",rs.getObject("max_uses"));m.put("onePerGuest",rs.getBoolean("one_per_guest"));m.put("active",rs.getBoolean("active"));
                m.put("uses",rs.getInt("uses"));m.put("discountGiven",rs.getBigDecimal("discount_given"));return m;},hotelId);
    }

    /**
     * Creates a code. {@code hotelId} null = a platform promotion (administrators only, prices in USD), which may
     * carry a headline and theme and be featured on the home page; hotel codes ignore those fields.
     */
    @Transactional
    public Map<String,Object> create(UUID hotelId,UUID actorId,PromotionRequest body){
        String code=normalise(body.code());
        if(!code.matches("[A-Z0-9][A-Z0-9_-]{2,31}"))throw bad("Use 3 to 32 letters, digits, - or _ for the code");
        boolean percent="PERCENT".equals(body.discountType()),platform=hotelId==null;
        if(percent&&body.discountValue().compareTo(BigDecimal.valueOf(100))>0)throw bad("A percentage discount can be at most 100%");
        if(body.startsOn()!=null&&body.endsOn()!=null&&body.endsOn().isBefore(body.startsOn()))throw bad("The end date must be on or after the start date");
        Integer taken=jdbc.queryForObject("SELECT count(*) FROM promotion_code WHERE hotel_id IS NOT DISTINCT FROM ?::uuid AND code=?",Integer.class,hotelId,code);
        if(taken!=null&&taken>0)throw new ResponseStatusException(HttpStatus.CONFLICT,(platform?"A platform promotion":"This hotel")+" already has a code "+code);
        String currency=percent?null:platform?"USD":jdbc.query("SELECT currency FROM room_type WHERE hotel_id=? ORDER BY name LIMIT 1",(rs,n)->rs.getString(1).trim(),hotelId).stream().findFirst().orElse("USD");
        String theme=platform&&body.theme()!=null?body.theme():"GENERAL";
        UUID id=UUID.randomUUID();
        jdbc.update("INSERT INTO promotion_code(id,hotel_id,code,description,discount_type,discount_value,currency,starts_on,ends_on,min_nights,max_uses,one_per_guest,headline,theme,featured) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id,hotelId,code,blankToNull(body.description()),body.discountType(),body.discountValue(),currency,
            body.startsOn(),body.endsOn(),body.minNights()==null?1:body.minNights(),body.maxUses(),body.onePerGuest()==null||body.onePerGuest(),
            platform?blankToNull(body.headline()):null,theme,platform&&Boolean.TRUE.equals(body.featured()));
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id,details) VALUES(?,?,'PROMOTION_CREATED','PromotionCode',?,jsonb_build_object('code',?::text))",actorId,hotelId,id,code);
        return Map.of("id",id,"code",code);
    }

    /** Pause/resume, and for platform promotions also show or hide on the home page. Null leaves a flag unchanged. */
    @Transactional
    public Map<String,Object> update(UUID hotelId,UUID promotionId,UUID actorId,Boolean active,Boolean featured){
        if(featured!=null&&hotelId!=null)throw bad("Only platform promotions can be featured on the home page");
        int changed=jdbc.update("UPDATE promotion_code SET active=COALESCE(?,active),featured=COALESCE(?,featured) WHERE id=? AND hotel_id IS NOT DISTINCT FROM ?::uuid",active,featured,promotionId,hotelId);
        if(changed==0)throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Promotion code not found");
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id,details) VALUES(?,?,'PROMOTION_STATUS_CHANGED','PromotionCode',?,jsonb_strip_nulls(jsonb_build_object('active',?::boolean,'featured',?::boolean)))",actorId,hotelId,promotionId,active,featured);
        var result=new LinkedHashMap<String,Object>();result.put("id",promotionId);
        jdbc.query("SELECT active,featured FROM promotion_code WHERE id=?",rs->{result.put("active",rs.getBoolean(1));result.put("featured",rs.getBoolean(2));},promotionId);
        return result;
    }

    /** Platform promotions to advertise now: active, featured and inside their bookable window (Cambodia time). */
    @Transactional(readOnly=true)
    public List<Map<String,Object>> featured(){
        LocalDate today=LocalDate.now(ZoneId.of("Asia/Phnom_Penh"));
        return jdbc.query("SELECT code,headline,description,discount_type,discount_value,currency,ends_on,min_nights,theme FROM promotion_code WHERE hotel_id IS NULL AND active AND featured AND (starts_on IS NULL OR starts_on<=?) AND (ends_on IS NULL OR ends_on>=?) ORDER BY ends_on NULLS LAST,created_at DESC LIMIT 4",
            (rs,n)->{var m=new LinkedHashMap<String,Object>();m.put("code",rs.getString("code"));m.put("headline",rs.getString("headline"));m.put("description",rs.getString("description"));
                m.put("discountType",rs.getString("discount_type"));m.put("discountValue",rs.getBigDecimal("discount_value"));m.put("currency",rs.getString("currency")==null?null:rs.getString("currency").trim());
                m.put("endsOn",rs.getObject("ends_on",LocalDate.class));m.put("minNights",rs.getInt("min_nights"));m.put("theme",rs.getString("theme"));return m;},today,today);
    }

    private static String blankToNull(String s){return s==null||s.isBlank()?null:s.trim();}

    private static ResponseStatusException bad(String reason){return new ResponseStatusException(HttpStatus.BAD_REQUEST,reason);}
}
