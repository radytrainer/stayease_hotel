package com.stayease.reception.controller;

import com.stayease.payment.service.HotelPaymentService;
import com.stayease.reservation.entity.ReservationStatus;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/reception/hotels/{hotelId}")
@PreAuthorize("hasRole('RECEPTIONIST')")
public class ReceptionController {
    private final JdbcTemplate jdbc; private final HotelPaymentService hotelPayments;
    public ReceptionController(JdbcTemplate jdbc,HotelPaymentService hotelPayments){this.jdbc=jdbc;this.hotelPayments=hotelPayments;}
    private void requireReceptionist(UUID hotel,UUID user){Integer n=jdbc.queryForObject("SELECT count(*) FROM hotel_staff WHERE hotel_id=? AND user_id=? AND staff_role='RECEPTIONIST'",Integer.class,hotel,user);if(n==null||n==0)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"You are not assigned to reception at this hotel");}

    @GetMapping("/arrivals")
    public List<Map<String,Object>> arrivals(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@RequestParam LocalDate date){requireReceptionist(hotelId,user);return jdbc.queryForList("SELECT r.id,r.status,r.check_in,r.check_out,r.guest_count,u.full_name AS guest_name,u.email,string_agg(DISTINCT rr.room_type_name,', ') AS room_type_name,string_agg(rm.room_number,', ' ORDER BY rm.room_number) AS room_numbers,(SELECT p.amount FROM payment p WHERE p.reservation_id=r.id AND p.provider='hotel' AND p.status='PENDING') AS amount_due,r.currency FROM reservation r JOIN app_user u ON u.id=r.guest_id JOIN reservation_room rr ON rr.reservation_id=r.id JOIN room rm ON rm.id=rr.room_id WHERE r.hotel_id=? AND ((r.check_in=? AND r.status='CONFIRMED') OR (r.check_out=? AND r.status='CHECKED_IN')) GROUP BY r.id,u.full_name,u.email ORDER BY u.full_name",hotelId,date,date);}

    @GetMapping("/payments/outstanding")
    public List<Map<String,Object>> outstanding(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId){requireReceptionist(hotelId,user);return hotelPayments.outstanding(hotelId);}

    @PostMapping("/reservations/{reservationId}/payment-received")
    public Map<String,Object> paymentReceived(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@PathVariable UUID reservationId){requireReceptionist(hotelId,user);return hotelPayments.markReceived(hotelId,reservationId,user);}

    @PostMapping("/reservations/{reservationId}/check-in") @Transactional
    public Map<String,Object> checkIn(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@PathVariable UUID reservationId){
        requireReceptionist(hotelId,user);var rows=jdbc.query("SELECT status,check_in,check_out FROM reservation WHERE id=? AND hotel_id=? FOR UPDATE",(rs,n)->new Object[]{rs.getString(1),rs.getDate(2).toLocalDate(),rs.getDate(3).toLocalDate()},reservationId,hotelId);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Reservation not found");Object[] booking=rows.getFirst();try{ReservationStatus.valueOf((String)booking[0]).transitionTo(ReservationStatus.CHECKED_IN,false);}catch(IllegalStateException|IllegalArgumentException e){throw new ResponseStatusException(HttpStatus.CONFLICT,"Reservation is not eligible for check-in");}
        LocalDate today=LocalDate.now(java.time.ZoneId.of(jdbc.queryForObject("SELECT timezone FROM hotel WHERE id=?",String.class,hotelId)));
        if(today.isBefore((LocalDate)booking[1])||!today.isBefore((LocalDate)booking[2]))throw new ResponseStatusException(HttpStatus.CONFLICT,"Check-in is outside the reservation stay dates");
        jdbc.update("UPDATE reservation SET status='CHECKED_IN',updated_at=now() WHERE id=?",reservationId);
        jdbc.update("INSERT INTO check_in_record(reservation_id,action,staff_user_id) VALUES(?,'CHECK_IN',?)",reservationId,user);
        jdbc.update("INSERT INTO reservation_status_history(reservation_id,from_status,to_status,actor_user_id,reason) VALUES(?,?,'CHECKED_IN',?,'Reception check-in')",reservationId,booking[0],user);
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id) VALUES(?,?,'GUEST_CHECKED_IN','Reservation',?)",user,hotelId,reservationId);
        return Map.of("reservationId",reservationId,"status","CHECKED_IN");
    }

    @PostMapping("/reservations/{reservationId}/check-out") @Transactional
    public Map<String,Object> checkOut(@AuthenticationPrincipal UUID user,@PathVariable UUID hotelId,@PathVariable UUID reservationId){
        requireReceptionist(hotelId,user);var rows=jdbc.query("SELECT status,check_out FROM reservation WHERE id=? AND hotel_id=? FOR UPDATE",(rs,n)->new Object[]{rs.getString(1),rs.getDate(2).toLocalDate()},reservationId,hotelId);
        if(rows.isEmpty())throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Reservation not found");Object[] booking=rows.getFirst();try{ReservationStatus.valueOf((String)booking[0]).transitionTo(ReservationStatus.CHECKED_OUT,false);}catch(IllegalStateException|IllegalArgumentException e){throw new ResponseStatusException(HttpStatus.CONFLICT,"Reservation is not eligible for check-out");}
        LocalDate today=LocalDate.now(java.time.ZoneId.of(jdbc.queryForObject("SELECT timezone FROM hotel WHERE id=?",String.class,hotelId)));
        if(today.isBefore((LocalDate)booking[1]))throw new ResponseStatusException(HttpStatus.CONFLICT,"Check-out cannot be recorded before the reservation check-out date");
        jdbc.update("UPDATE reservation SET status='CHECKED_OUT',updated_at=now() WHERE id=?",reservationId);
        jdbc.update("INSERT INTO check_in_record(reservation_id,action,staff_user_id) VALUES(?,'CHECK_OUT',?)",reservationId,user);
        jdbc.update("INSERT INTO reservation_status_history(reservation_id,from_status,to_status,actor_user_id,reason) VALUES(?,?,'CHECKED_OUT',?,'Reception check-out')",reservationId,booking[0],user);
        jdbc.update("INSERT INTO audit_log(actor_user_id,hotel_id,action,entity_type,entity_id) VALUES(?,?,'GUEST_CHECKED_OUT','Reservation',?)",user,hotelId,reservationId);
        return Map.of("reservationId",reservationId,"status","CHECKED_OUT");
    }
}

