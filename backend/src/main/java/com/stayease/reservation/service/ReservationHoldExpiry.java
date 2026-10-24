package com.stayease.reservation.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import com.stayease.reservation.entity.ReservationStatus;
import com.stayease.notification.service.NotificationService;

@Component
public class ReservationHoldExpiry {
    private final JdbcTemplate jdbc; private final NotificationService notifications;
    public ReservationHoldExpiry(JdbcTemplate jdbc,NotificationService notifications) { this.jdbc=jdbc;this.notifications=notifications; }

    @Scheduled(fixedDelay=30_000)
    @Transactional
    public void releaseExpiredHolds() {
        var ids=jdbc.query("SELECT id FROM reservation WHERE status='PENDING_PAYMENT' AND hold_expires_at<now() ORDER BY hold_expires_at LIMIT 100 FOR UPDATE SKIP LOCKED",(rs,n)->rs.getObject(1,UUID.class));
        for(UUID id:ids) {
            ReservationStatus.PENDING_PAYMENT.transitionTo(ReservationStatus.EXPIRED,false);
            jdbc.update("UPDATE room_occupancy SET active=false WHERE reservation_room_id IN (SELECT id FROM reservation_room WHERE reservation_id=?)",id);
            jdbc.update("UPDATE reservation SET status='EXPIRED',updated_at=now() WHERE id=? AND status='PENDING_PAYMENT'",id);
            jdbc.update("INSERT INTO reservation_status_history(reservation_id,from_status,to_status,reason) VALUES(?,'PENDING_PAYMENT','EXPIRED','Inventory hold elapsed')",id);
            notifications.enqueueReservationEvent(id,"RESERVATION_EXPIRED");
        }
    }
}

