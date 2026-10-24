package com.stayease.payment.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.HexFormat;
import static org.junit.jupiter.api.Assertions.*;

class StripePaymentGatewayTest {
    @Test void validatesWebhookSignatureBeforeParsingEvent() throws Exception {
        String secret="whsec_test_only",payload="""
            {"id":"evt_test","type":"payment_intent.succeeded","data":{"object":{"id":"pi_test","metadata":{"reservation_id":"10000000-0000-4000-8000-000000000001"}}}}
            """.trim();
        String timestamp=Long.toString(Instant.now().getEpochSecond());
        Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
        String signature=HexFormat.of().formatHex(mac.doFinal((timestamp+"."+payload).getBytes(StandardCharsets.UTF_8)));
        var gateway=new StripePaymentGateway(org.springframework.web.client.RestClient.builder(),new ObjectMapper(),"",secret,"http://localhost:3000");
        var event=gateway.verifyWebhook(payload,"t="+timestamp+",v1="+signature);
        assertEquals("evt_test",event.eventId());assertEquals("payment_intent.succeeded",event.type());assertEquals("pi_test",event.paymentIntentId());
        assertThrows(org.springframework.web.server.ResponseStatusException.class,()->gateway.verifyWebhook(payload+" ","t="+timestamp+",v1="+signature));
    }

    @Test void convertsCurrencyAmountsWithoutRounding() {
        assertEquals("1250",StripePaymentGateway.minorUnits(new java.math.BigDecimal("12.50"),"USD"));
        assertEquals("1250",StripePaymentGateway.minorUnits(new java.math.BigDecimal("1250"),"JPY"));
        assertThrows(IllegalArgumentException.class,()->StripePaymentGateway.minorUnits(new java.math.BigDecimal("1.001"),"USD"));
    }
}

