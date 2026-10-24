package com.stayease.integration;

import com.stayease.hotel.service.HotelQueryService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

/** Unsplash photos are hotlinked with the photographer credit; nothing else may be hotlinked. */
class ExternalPhotoIntegrationTest extends PostgresIntegrationTest {
    @Autowired HotelQueryService hotels;
    private static final String IMG = "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1600";
    private static final String CREDIT = "https://unsplash.com/@someone?utm_source=stayease&utm_medium=referral";

    private String slug(UUID hotel) { return jdbc.queryForObject("SELECT slug FROM hotel WHERE id=?", String.class, hotel); }

    @Test @SuppressWarnings("unchecked")
    void hotlinkedPhotosCarryTheirUrlAndCreditEverywhere() {
        UUID hotel = approvedHotel(), type = roomType(hotel, "Deluxe Double", 2, "46.00");
        room(hotel, type, "101");
        jdbc.update("INSERT INTO hotel_image(id,hotel_id,source_url,credit_name,credit_url,sort_order) VALUES(?,?,?,?,?,0)", UUID.randomUUID(), hotel, IMG, "Dara Sok", CREDIT);
        jdbc.update("INSERT INTO room_type_image(id,room_type_id,source_url,credit_name,credit_url,content_type,category) VALUES(?,?,?,?,?,'image/jpeg','BATHROOM')", UUID.randomUUID(), type, IMG, "Dara Sok", CREDIT);

        var card = hotels.search("Phnom Penh", null, null, 1).stream().filter(h -> hotel.equals(h.get("id"))).findFirst().orElseThrow();
        assertEquals(IMG, card.get("coverImageUrl"));
        assertEquals("Dara Sok", card.get("coverCreditName"));

        var image = ((List<Map<String, Object>>) hotels.details(slug(hotel)).get("images")).getFirst();
        assertEquals(IMG, image.get("url"));
        assertEquals(CREDIT, image.get("creditUrl"));

        var photo = ((List<Map<String, Object>>) hotels.availability(slug(hotel), LocalDate.now().plusDays(30), LocalDate.now().plusDays(31), 1).getFirst().get("photos")).getFirst();
        assertEquals("BATHROOM", photo.get("category"));
        assertEquals(IMG, photo.get("url"));
        assertEquals("Dara Sok", photo.get("creditName"));
    }

    @Test void onlyUnsplashMayBeHotlinkedAndOnlyWithACredit() {
        UUID hotel = approvedHotel();
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("INSERT INTO hotel_image(id,hotel_id,source_url,credit_name,credit_url) VALUES(?,?,'https://evil.example/x.jpg','x',?)", UUID.randomUUID(), hotel, CREDIT), "other hosts");
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("INSERT INTO hotel_image(id,hotel_id,source_url) VALUES(?,?,?)", UUID.randomUUID(), hotel, IMG), "missing credit");
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("INSERT INTO hotel_image(id,hotel_id) VALUES(?,?)", UUID.randomUUID(), hotel), "no source at all");
        assertThrows(DataIntegrityViolationException.class, () -> jdbc.update("INSERT INTO hotel_image(id,hotel_id,object_key,source_url,credit_name,credit_url) VALUES(?,?,'k',?,'x',?)", UUID.randomUUID(), hotel, IMG, CREDIT), "both stored and hotlinked");
    }
}
