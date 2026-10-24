package com.stayease.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class NotificationService {
    private final JdbcTemplate jdbc; private final ObjectMapper json;
    public NotificationService(JdbcTemplate jdbc,ObjectMapper json) { this.jdbc=jdbc;this.json=json; }

    public void enqueueReservationEvent(UUID reservationId, String template) {
        enqueueReservationEvent(reservationId, template, Map.of());
    }

    /** {@code details} are merged into the standard reservation payload, e.g. the amount of a refund. */
    public void enqueueReservationEvent(UUID reservationId, String template, Map<String,Object> details) {
        String extra;
        try { extra=json.writeValueAsString(details); }
        catch (Exception e) { throw new IllegalArgumentException("Notification details must be JSON-serialisable",e); }
        jdbc.update("""
            INSERT INTO notification(user_id,reservation_id,channel,template,payload)
            SELECT r.guest_id,r.id,channels.channel,?,jsonb_build_object(
                'hotelName',h.name,'checkIn',r.check_in,'checkOut',r.check_out,
                'currency',r.currency,'total',r.total_amount,'status',r.status) || ?::jsonb
            FROM reservation r JOIN hotel h ON h.id=r.hotel_id
            CROSS JOIN (VALUES ('IN_APP'),('EMAIL')) AS channels(channel)
            WHERE r.id=?
            """, template, extra, reservationId);
    }

    public List<Map<String,Object>> inbox(UUID userId) {
        return jdbc.query("""
            SELECT id,template,payload,created_at,read_at
            FROM notification WHERE user_id=? AND channel='IN_APP'
            ORDER BY created_at DESC LIMIT 50
            """, (rs,n)->Map.<String,Object>of(
                "id",rs.getObject("id"),"template",rs.getString("template"),
                "payload",parsePayload(rs.getString("payload")),"createdAt",rs.getObject("created_at"),
                "read",rs.getObject("read_at")!=null), userId);
    }

    private JsonNode parsePayload(String payload) {
        try { return json.readTree(payload); }
        catch (Exception e) { throw new IllegalStateException("Stored notification payload is invalid",e); }
    }

    public boolean markRead(UUID userId, UUID notificationId) {
        return jdbc.update("UPDATE notification SET read_at=COALESCE(read_at,now()),status='READ' WHERE id=? AND user_id=? AND channel='IN_APP'",notificationId,userId)>0;
    }

    public record EmailItem(UUID id,String email,String fullName,String template,JsonNode payload) {}

    public List<EmailItem> claimEmailBatch() {
        jdbc.update("UPDATE notification SET status='FAILED',last_error='Email notification expired before delivery',updated_at=now() WHERE channel='EMAIL' AND status IN ('PENDING','PROCESSING') AND created_at<now()-interval '7 days'");
        return jdbc.query("""
            WITH selected AS MATERIALIZED (
                SELECT id FROM notification
                WHERE channel='EMAIL' AND attempts<8 AND (
                    (status='PENDING' AND next_attempt_at<=now()) OR
                    (status='PROCESSING' AND updated_at<now()-interval '10 minutes'))
                ORDER BY created_at LIMIT 20 FOR UPDATE SKIP LOCKED
            ), claimed AS (
                UPDATE notification n SET status='PROCESSING',updated_at=now()
                FROM selected s WHERE n.id=s.id
                RETURNING n.id,n.user_id,n.template,n.payload
            )
            SELECT c.id,u.email,u.full_name,c.template,c.payload
            FROM claimed c JOIN app_user u ON u.id=c.user_id
            """,(rs,n)->new EmailItem(rs.getObject("id",UUID.class),rs.getString("email"),
                rs.getString("full_name"),rs.getString("template"),parsePayload(rs.getString("payload"))));
    }

    public void emailSent(UUID id,String providerReference) {
        jdbc.update("UPDATE notification SET status='SENT',sent_at=now(),provider_reference=?,last_error=NULL,updated_at=now() WHERE id=? AND channel='EMAIL' AND status='PROCESSING'",providerReference,id);
    }

    public void emailFailed(UUID id,String error) {
        jdbc.update("UPDATE notification SET attempts=attempts+1,status=CASE WHEN attempts+1>=8 THEN 'FAILED' ELSE 'PENDING' END,next_attempt_at=now()+make_interval(secs=>LEAST(3600,power(2,LEAST(attempts,10))::integer*30)),last_error=?,updated_at=now() WHERE id=? AND channel='EMAIL' AND status='PROCESSING'",error==null?"Email provider request failed":error.substring(0,Math.min(error.length(),1000)),id);
    }
}

