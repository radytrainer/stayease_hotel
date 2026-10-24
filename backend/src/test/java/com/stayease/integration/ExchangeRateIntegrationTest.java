package com.stayease.integration;

import com.stayease.common.controller.ExchangeRateController;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class ExchangeRateIntegrationTest extends PostgresIntegrationTest {
    @Autowired ExchangeRateController rates;

    @Test @SuppressWarnings("unchecked")
    void servesTheConfiguredRielRateWithItsDateAndSource() {
        var body = rates.rates();
        assertEquals("USD", body.get("base"));
        assertEquals(0, new BigDecimal("4067").compareTo((BigDecimal) ((Map<String, Object>) body.get("rates")).get("KHR")));
        assertEquals(LocalDate.of(2026, 10, 16), body.get("publishedOn"));
        assertEquals("National Bank of Cambodia official rate", body.get("source"));
    }

    @Test void rejectsANonPositiveRateAtStartup() {
        assertThrows(IllegalStateException.class, () -> new ExchangeRateController(BigDecimal.ZERO, LocalDate.now(), "test"));
    }
}
