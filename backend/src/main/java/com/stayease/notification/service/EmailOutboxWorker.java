package com.stayease.notification.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnExpression("'${app.email.api-key:}' != '' and '${app.email.from:}' != ''")
public class EmailOutboxWorker {
    private static final Logger log=LoggerFactory.getLogger(EmailOutboxWorker.class);
    private final NotificationService notifications; private final ResendEmailAdapter email;
    public EmailOutboxWorker(NotificationService notifications,ResendEmailAdapter email){this.notifications=notifications;this.email=email;}

    @Scheduled(fixedDelayString="${app.email.poll-interval-ms:5000}")
    public void deliver() {
        for(var item:notifications.claimEmailBatch()) {
            try { notifications.emailSent(item.id(),email.send(item)); }
            catch(Exception e) {
                log.warn("Email delivery failed for outbox item {}: {}",item.id(),e.getMessage());
                notifications.emailFailed(item.id(),e.getMessage());
            }
        }
    }
}

