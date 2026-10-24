package com.stayease.payment.service;

import java.math.BigDecimal;
import java.util.UUID;

public interface PaymentGateway {
    record CheckoutRequest(UUID reservationId, String reservationLabel, BigDecimal amount, String currency, String idempotencyKey) {}
    record CheckoutSession(String reference, String url) {}
    record VerifiedEvent(String eventId, String type, String paymentIntentId, UUID reservationId, Long amountMinor, String currency) {}
    record RefundResult(String reference, String status) {}
    /** True when card checkout can both start and be confirmed (API key and webhook secret are set). */
    boolean onlineCheckoutAvailable();
    CheckoutSession createCheckout(CheckoutRequest request);
    VerifiedEvent verifyWebhook(String payload, String signatureHeader);
    RefundResult refund(String paymentIntentId, BigDecimal amount, String currency, String idempotencyKey);
}

