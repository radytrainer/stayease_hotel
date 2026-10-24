package com.stayease.common.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;

/**
 * Display-only exchange rate so guests can view prices in riel. Hotels price and charge in their own
 * currency (normally USD); this rate is never used to compute an amount that is charged or refunded.
 */
@RestController
@RequestMapping("/api/v1")
public class ExchangeRateController {
    private final BigDecimal khrPerUsd;
    private final LocalDate publishedOn;
    private final String source;

    public ExchangeRateController(@Value("${app.exchange.khr-per-usd}") BigDecimal khrPerUsd,
                                  @Value("${app.exchange.published-on}") LocalDate publishedOn,
                                  @Value("${app.exchange.source}") String source) {
        if (khrPerUsd.signum() <= 0) throw new IllegalStateException("app.exchange.khr-per-usd must be positive");
        this.khrPerUsd = khrPerUsd; this.publishedOn = publishedOn; this.source = source;
    }

    @GetMapping("/exchange-rates")
    public Map<String, Object> rates() {
        return Map.of("base", "USD", "rates", Map.of("KHR", khrPerUsd), "publishedOn", publishedOn, "source", source);
    }
}
