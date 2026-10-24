package com.stayease.notification.controller;

import com.stayease.notification.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService notifications;
    public NotificationController(NotificationService notifications) { this.notifications=notifications; }

    @GetMapping
    public List<Map<String,Object>> inbox(@AuthenticationPrincipal UUID userId) {
        return notifications.inbox(userId);
    }

    @PatchMapping("/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@AuthenticationPrincipal UUID userId, @PathVariable UUID id) {
        if(!notifications.markRead(userId,id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Notification not found");
    }
}

