package com.stayease.payment.controller;

import com.stayease.payment.service.HotelPaymentService;
import com.stayease.payment.service.PaymentGateway;
import com.stayease.payment.service.PaymentOrchestrator;
import com.stayease.payment.service.PaymentRecordService;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class PaymentController {
    private final PaymentOrchestrator payments; private final PaymentGateway gateway; private final PaymentRecordService records; private final HotelPaymentService hotelPayments;
    public PaymentController(PaymentOrchestrator payments,PaymentGateway gateway,PaymentRecordService records,HotelPaymentService hotelPayments){this.payments=payments;this.gateway=gateway;this.records=records;this.hotelPayments=hotelPayments;}

    /** Which ways to pay the checkout page should offer. */
    @GetMapping("/payments/options")
    public Map<String,Boolean> options(){return Map.of("online",gateway.onlineCheckoutAvailable(),"payAtHotel",true);}

    @PostMapping("/reservations/{reservationId}/checkout") @PreAuthorize("hasRole('GUEST')")
    public PaymentOrchestrator.CheckoutResponse checkout(@AuthenticationPrincipal UUID guestId,@PathVariable UUID reservationId){return payments.checkout(guestId,reservationId);}

    @PostMapping("/reservations/{reservationId}/pay-at-hotel") @PreAuthorize("hasRole('GUEST')")
    public HotelPaymentService.Choice payAtHotel(@AuthenticationPrincipal UUID guestId,@PathVariable UUID reservationId){return hotelPayments.payAtHotel(guestId,reservationId);}

    @PostMapping("/payments/webhooks/stripe")
    public Map<String,String> webhook(@RequestBody String payload,@RequestHeader(value="Stripe-Signature",required=false) String signature){
        var event=gateway.verifyWebhook(payload,signature);String outcome=records.process(event);return Map.of("received","true","outcome",outcome);
    }
}

