package com.stayease.reservation.entity;

import java.math.BigDecimal;

public final class CancellationPolicy {
    private CancellationPolicy() {}
    public static BigDecimal refundPercent(int freeCancelHours,BigDecimal lateRefundPercent,long hoursUntilCheckIn) {
        if(freeCancelHours<0 || lateRefundPercent==null || lateRefundPercent.signum()<0 || lateRefundPercent.compareTo(BigDecimal.valueOf(100))>0)
            throw new IllegalArgumentException("Invalid cancellation policy");
        return freeCancelHours>0&&hoursUntilCheckIn>=freeCancelHours?BigDecimal.valueOf(100):lateRefundPercent;
    }
}

