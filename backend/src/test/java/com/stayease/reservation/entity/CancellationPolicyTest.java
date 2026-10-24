package com.stayease.reservation.entity;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class CancellationPolicyTest {
    @Test void providesFullRefundInsideFreeCancellationWindow(){
        assertEquals(new BigDecimal("100"),CancellationPolicy.refundPercent(48,new BigDecimal("25"),48));
        assertEquals(new BigDecimal("25"),CancellationPolicy.refundPercent(48,new BigDecimal("25"),47));
    }
    @Test void zeroWindowUsesConfiguredRefundRate(){
        assertEquals(new BigDecimal("10"),CancellationPolicy.refundPercent(0,new BigDecimal("10"),300));
    }
}

