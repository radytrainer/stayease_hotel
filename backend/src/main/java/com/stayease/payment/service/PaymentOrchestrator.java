package com.stayease.payment.service;

import org.springframework.stereotype.Service;
import java.util.UUID;

@Service
public class PaymentOrchestrator {
    private final PaymentRecordService records; private final PaymentGateway gateway;
    public PaymentOrchestrator(PaymentRecordService records,PaymentGateway gateway){this.records=records;this.gateway=gateway;}
    public record CheckoutResponse(String checkoutUrl,String status){}
    public CheckoutResponse checkout(UUID guestId,UUID reservationId) {
        var order=records.prepare(guestId,reservationId);
        if(order.url()!=null) return new CheckoutResponse(order.url(),"PENDING");
        var session=gateway.createCheckout(new PaymentGateway.CheckoutRequest(order.reservationId(),"StayEase reservation "+reservationId,order.amount(),order.currency(),order.idempotencyKey()));
        records.saveCheckout(order.paymentId(),session);
        return new CheckoutResponse(session.url(),"PENDING");
    }
}

