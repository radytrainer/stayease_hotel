package com.stayease.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import java.util.List;
import java.util.Map;

@Component
@ConditionalOnExpression("'${app.email.api-key:}' != '' and '${app.email.from:}' != ''")
public class ResendEmailAdapter {
    private final RestClient http=RestClient.create();
    private final String apiUrl,apiKey,from;

    public ResendEmailAdapter(@Value("${app.email.api-url}")String apiUrl,
                              @Value("${app.email.api-key}")String apiKey,
                              @Value("${app.email.from}")String from) {
        this.apiUrl=apiUrl;this.apiKey=apiKey;this.from=from;
    }

    public String send(NotificationService.EmailItem item) {
        JsonNode payload=item.payload();
        String hotel=payload.path("hotelName").asText("your hotel");
        String dates=payload.path("checkIn").asText()+" to "+payload.path("checkOut").asText();
        String subject,body;
        switch(item.template()){
            case "RESERVATION_CONFIRMED"->{subject="Your StayEase reservation is confirmed";body="Your reservation is confirmed at "+hotel+" for "+dates+"."
                +("HOTEL".equals(payload.path("paymentMethod").asText())?" Please pay "+payload.path("amountDue").asText()+" "+payload.path("currency").asText()+" at the front desk when you arrive.":"");}
            case "RESERVATION_CANCELLED"->{subject="Your StayEase reservation was cancelled";body="Your reservation at "+hotel+" for "+dates+" was cancelled.";}
            case "RESERVATION_EXPIRED"->{subject="Your StayEase room hold has expired";body="We held rooms at "+hotel+" for "+dates+", but payment wasn't completed in time, so they have been released. You have not been charged.";}
            case "REFUND_ISSUED"->{subject="Your StayEase refund is on its way";body="We have refunded "+payload.path("refundAmount").asText()+" "+payload.path("refundCurrency").asText()+" for your stay at "+hotel+" ("+dates+") to your original payment method. Banks usually take 5 to 10 business days to show it.";}
            default->{subject="Your StayEase reservation is on hold";body="We are holding your reservation at "+hotel+" for "+dates+".";}
        }
        String message="Hello "+item.fullName()+",\n\n"+body+"\n"+
            "Reservation status: "+payload.path("status").asText()+".\n\n"+
            "Manage your reservation in your StayEase account.\n\nStayEase";
        JsonNode response=http.post().uri(apiUrl).header("Authorization","Bearer "+apiKey)
            .header("Idempotency-Key",item.id().toString())
            .contentType(MediaType.APPLICATION_JSON)
            .body(Map.of("from",from,"to",List.of(item.email()),"subject",subject,"text",message))
            .retrieve().body(JsonNode.class);
        return response==null?null:response.path("id").asText(null);
    }
}

