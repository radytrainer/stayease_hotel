package com.stayease.integration;

import com.stayease.hotel.service.HotelQueryService;
import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.service.ReservationService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

class RoomTypeAvailabilityIntegrationTest extends PostgresIntegrationTest {
    @Autowired HotelQueryService hotels;
    @Autowired ReservationService reservations;

    private final LocalDate checkIn = LocalDate.now().plusDays(90);

    private UUID room(UUID hotel, UUID type, String number, Integer floor) {
        UUID id = room(hotel, type, number);
        jdbc.update("UPDATE room SET floor=? WHERE id=?", floor, id);
        return id;
    }
    private Map<String, Object> option(List<Map<String, Object>> options, String type) {
        return options.stream().filter(o -> type.equals(o.get("roomType"))).findFirst().orElseThrow(() -> new AssertionError(type + " not offered: " + options));
    }

    @Test void identicalRoomsAreOfferedOnceWithHowManyAreFree() {
        UUID hotel = approvedHotel(), deluxe = roomType(hotel, "Deluxe Double", 2, "46.00"), suite = roomType(hotel, "Family Suite", 4, "90.00");
        jdbc.update("UPDATE room_type SET description='Double room with a balcony.' WHERE id=?", deluxe);
        room(hotel, deluxe, "101", 1); room(hotel, deluxe, "102", 1); room(hotel, deluxe, "201", 2); room(hotel, suite, "301", 3);
        String slug = jdbc.queryForObject("SELECT slug FROM hotel WHERE id=?", String.class, hotel);

        var options = hotels.availability(slug, checkIn, checkIn.plusDays(2), 2);
        assertEquals(2, options.size(), "one option per room type, not per room");
        var offer = option(options, "Deluxe Double");
        assertEquals(3, offer.get("available"));
        assertEquals(3, ((List<?>) offer.get("roomIds")).size());
        assertEquals("Double room with a balcony.", offer.get("description"));
        assertEquals(0, new BigDecimal("92.00").compareTo((BigDecimal) offer.get("total")));

        var ids = ((List<?>) offer.get("roomIds")).stream().map(id -> (UUID) id).toList();
        var booked = reservations.create(guest(), new ReservationCreateRequest(hotel, checkIn, checkIn.plusDays(2), 4, ids.subList(0, 2), UUID.randomUUID().toString()));
        assertEquals(0, new BigDecimal("184.00").compareTo(booked.total()), "two Deluxe Doubles for two nights");
        assertEquals(1, option(hotels.availability(slug, checkIn, checkIn.plusDays(2), 2), "Deluxe Double").get("available"), "two of three are now held");
    }

    @SuppressWarnings("unchecked")
    @Test void guestSeesTheAssignedRoomNumberAndFloor() {
        UUID hotel = approvedHotel(), type = roomType(hotel, "Deluxe Double", 2, "46.00"), guest = guest();
        UUID roomId = room(hotel, type, "204", 2);
        var booked = reservations.create(guest, new ReservationCreateRequest(hotel, checkIn, checkIn.plusDays(1), 2, List.of(roomId), UUID.randomUUID().toString()));
        var rooms = (List<Map<String, Object>>) reservations.summary(guest, booked.id()).get("rooms");
        assertEquals("204", rooms.getFirst().get("roomNumber"));
        assertEquals(2, ((Number) rooms.getFirst().get("floor")).intValue());
    }

    @Test void roomsWithoutAFloorAreAllowed() {
        UUID hotel = approvedHotel(), type = roomType(hotel, "Garden Villa", 2, "85.00");
        assertNull(jdbc.queryForObject("SELECT floor FROM room WHERE id=?", Integer.class, room(hotel, type, "V1", null)));
    }

    @SuppressWarnings("unchecked")
    @Test void roomTypePhotosAreListedRoomFirstWithPublicUrls() {
        UUID hotel = approvedHotel(), type = roomType(hotel, "Deluxe Double", 2, "46.00");
        room(hotel, type, "101");
        String slug = jdbc.queryForObject("SELECT slug FROM hotel WHERE id=?", String.class, hotel);
        UUID view = UUID.randomUUID(), bed = UUID.randomUUID(), bath = UUID.randomUUID();
        for (Object[] img : new Object[][]{{view, "VIEW"}, {bath, "BATHROOM"}, {bed, "ROOM"}})
            jdbc.update("INSERT INTO room_type_image(id,room_type_id,object_key,content_type,alt_text,category) VALUES(?,?,?,'image/jpeg','x',?)", img[0], type, "k/" + img[0], img[1]);
        var photos = (List<Map<String, Object>>) option(hotels.availability(slug, checkIn, checkIn.plusDays(1), 1), "Deluxe Double").get("photos");
        assertEquals(List.of("ROOM", "BATHROOM", "VIEW"), photos.stream().map(p -> p.get("category")).toList());
        assertEquals("/api/v1/hotels/" + slug + "/room-images/" + bed, photos.getFirst().get("url"));
    }

    @Test void roomPhotoCategoriesAreRestricted() {
        UUID hotel = approvedHotel(), type = roomType(hotel, "Deluxe Double", 2, "46.00");
        assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> jdbc.update(
            "INSERT INTO room_type_image(id,room_type_id,object_key,content_type,category) VALUES(?,?,'k','image/jpeg','SELFIE')", UUID.randomUUID(), type));
    }
}
