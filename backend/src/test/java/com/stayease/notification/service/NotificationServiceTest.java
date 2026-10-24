package com.stayease.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.UUID;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class NotificationServiceTest {
    @Test void enqueuesInAppAndEmailCopiesForReservationEvent() {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        NotificationService service=new NotificationService(jdbc,new ObjectMapper());
        UUID reservation=UUID.randomUUID();

        service.enqueueReservationEvent(reservation,"RESERVATION_CONFIRMED");

        verify(jdbc).update(anyString(),eq("RESERVATION_CONFIRMED"),eq("{}"),eq(reservation));
    }

    @Test void mergesEventDetailsIntoThePayload() {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        NotificationService service=new NotificationService(jdbc,new ObjectMapper());
        UUID reservation=UUID.randomUUID();

        service.enqueueReservationEvent(reservation,"REFUND_ISSUED",java.util.Map.of("refundAmount","25.00"));

        verify(jdbc).update(anyString(),eq("REFUND_ISSUED"),eq("{\"refundAmount\":\"25.00\"}"),eq(reservation));
    }
}

