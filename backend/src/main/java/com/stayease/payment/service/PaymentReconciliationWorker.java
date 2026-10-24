package com.stayease.payment.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.util.UUID;

@Component
public class PaymentReconciliationWorker {
    private final PaymentRecordService records;private final PaymentGateway gateway;
    public PaymentReconciliationWorker(PaymentRecordService records,PaymentGateway gateway){this.records=records;this.gateway=gateway;}
    @Scheduled(fixedDelay=20_000)
    public void refundLateAuthorizations(){
        for(Object[] work:records.pendingRefunds()){
            UUID id=(UUID)work[0];Object[] detail=records.refundDetails(id);if(detail==null)continue;
            UUID paymentId=(UUID)detail[0];String intent=(String)detail[1],key=(String)detail[2];java.math.BigDecimal amount=(java.math.BigDecimal)detail[3];String currency=(String)detail[4];UUID cancellation=(UUID)detail[5];
            try{var result=gateway.refund(intent,amount,currency,key);if("succeeded".equals(result.status()))records.refundSucceeded(id,paymentId,cancellation,key,result.reference(),amount,currency);else records.refundFailed(id);}
            catch(RuntimeException failure){records.refundFailed(id);}
        }
    }
}

