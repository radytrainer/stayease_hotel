package com.stayease.payment.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Component
public class StripePaymentGateway implements PaymentGateway {
    private final RestClient stripe;
    private final ObjectMapper json;
    private final String apiKey;
    private final String webhookSecret;
    private final String webOrigin;

    public StripePaymentGateway(RestClient.Builder builder, ObjectMapper json,
        @Value("${app.payment.stripe-secret-key:}") String apiKey,
        @Value("${app.payment.stripe-webhook-secret:}") String webhookSecret,
        @Value("${app.web-origin}") String webOrigin) {
        this.apiKey=apiKey; this.webhookSecret=webhookSecret; this.json=json; this.webOrigin=webOrigin;
        this.stripe=builder.baseUrl("https://api.stripe.com/v1").defaultHeaders(h->h.setBasicAuth(apiKey,"")).build();
    }

    @Override public boolean onlineCheckoutAvailable() { return !apiKey.isBlank() && !webhookSecret.isBlank(); }

    @Override public CheckoutSession createCheckout(CheckoutRequest request) {
        requireApiKey();
        MultiValueMap<String,String> form=new LinkedMultiValueMap<>();
        form.add("mode","payment"); form.add("success_url",webOrigin+"/reservation/held?payment=processing"); form.add("cancel_url",webOrigin+"/reservation/held?payment=cancelled");
        form.add("expires_at",Long.toString(java.time.Instant.now().getEpochSecond()+2100));
        form.add("payment_method_types[0]","card"); form.add("payment_intent_data[metadata][reservation_id]",request.reservationId().toString());
        form.add("line_items[0][quantity]","1"); form.add("line_items[0][price_data][currency]",request.currency().toLowerCase(java.util.Locale.ROOT));
        form.add("line_items[0][price_data][unit_amount]",minorUnits(request.amount(),request.currency()));
        form.add("line_items[0][price_data][product_data][name]",request.reservationLabel());
        JsonNode response=stripe.post().uri("/checkout/sessions").contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .header("Idempotency-Key",request.idempotencyKey()).body(form).retrieve().body(JsonNode.class);
        if(response==null || response.path("id").asText().isBlank() || response.path("url").asText().isBlank()) throw new IllegalStateException("Payment provider returned an incomplete checkout session");
        return new CheckoutSession(response.path("id").asText(),response.path("url").asText());
    }

    @Override public VerifiedEvent verifyWebhook(String payload,String signatureHeader) {
        if(webhookSecret.isBlank()) throw new IllegalStateException("Payment webhook is not configured");
        if(!validSignature(payload,signatureHeader)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid payment signature");
        try {
            JsonNode root=json.readTree(payload),object=root.path("data").path("object");
            UUID reservation=null; String id=object.path("metadata").path("reservation_id").asText("");
            if(!id.isBlank()) reservation=UUID.fromString(id);
            long amount=object.path("amount_received").asLong(object.path("amount").asLong(-1));
            return new VerifiedEvent(root.path("id").asText(),root.path("type").asText(),object.path("id").asText(),reservation,amount,object.path("currency").asText("").toUpperCase(java.util.Locale.ROOT));
        } catch(Exception e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid payment event"); }
    }

    @Override public RefundResult refund(String paymentIntentId,BigDecimal amount,String currency,String idempotencyKey) {
        requireApiKey(); MultiValueMap<String,String> form=new LinkedMultiValueMap<>(); form.add("payment_intent",paymentIntentId);form.add("amount",minorUnits(amount,currency));
        JsonNode response=stripe.post().uri("/refunds").contentType(MediaType.APPLICATION_FORM_URLENCODED).header("Idempotency-Key",idempotencyKey).body(form).retrieve().body(JsonNode.class);
        if(response==null || response.path("id").asText().isBlank()) throw new IllegalStateException("Payment provider returned an incomplete refund");
        return new RefundResult(response.path("id").asText(),response.path("status").asText("pending"));
    }

    private void requireApiKey(){if(apiKey.isBlank())throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"Online checkout is not configured");}
    static String minorUnits(BigDecimal amount,String currency) {
        int exponent=switch(currency.toUpperCase(java.util.Locale.ROOT)){case "BIF","CLP","DJF","GNF","ISK","JPY","KMF","KRW","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF"->0;case "BHD","JOD","KWD","OMR","TND"->3;default->2;};
        try{return amount.movePointRight(exponent).setScale(0,RoundingMode.UNNECESSARY).toPlainString();}
        catch(ArithmeticException e){throw new IllegalArgumentException("Amount precision is unsupported for currency " + currency);}
    }
    static BigDecimal decimalAmount(long minor,String currency){
        int exponent=switch(currency.toUpperCase(java.util.Locale.ROOT)){case "BIF","CLP","DJF","GNF","ISK","JPY","KMF","KRW","PYG","RWF","UGX","VND","VUV","XAF","XOF","XPF"->0;case "BHD","JOD","KWD","OMR","TND"->3;default->2;};
        return BigDecimal.valueOf(minor,exponent).setScale(4);
    }
    private boolean validSignature(String payload,String header) {
        if(header==null || header.length()>2048) return false;
        String timestamp=null; var signatures=new java.util.ArrayList<String>();
        for(String part:header.split(",")){int eq=part.indexOf('=');if(eq<1)continue;String key=part.substring(0,eq).trim(),value=part.substring(eq+1).trim();if(key.equals("t"))timestamp=value;else if(key.equals("v1"))signatures.add(value);}
        if(timestamp==null || signatures.isEmpty())return false;
        try {
            long epoch=Long.parseLong(timestamp); if(Math.abs(Instant.now().getEpochSecond()-epoch)>300)return false;
            Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(webhookSecret.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
            byte[] expected=mac.doFinal((timestamp+"."+payload).getBytes(StandardCharsets.UTF_8));String expectedHex=HexFormat.of().formatHex(expected);
            return signatures.stream().anyMatch(s->MessageDigest.isEqual(expectedHex.getBytes(StandardCharsets.US_ASCII),s.getBytes(StandardCharsets.US_ASCII)));
        } catch(Exception e){return false;}
    }
}

