package com.stayease.common.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** Background workers (hold expiry, email outbox, payment reconciliation). Tests disable them to drive the jobs directly. */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name="app.scheduling.enabled", havingValue="true", matchIfMissing=true)
public class SchedulingConfig {}
