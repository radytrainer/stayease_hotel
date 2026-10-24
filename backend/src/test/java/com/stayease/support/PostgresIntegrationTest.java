package com.stayease.support;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Runs against the same PostgreSQL major version as production so range types, GiST exclusion constraints,
 * deferred constraint triggers and row locks behave exactly as deployed. One container is shared by all
 * integration test classes; each test creates its own hotel and rooms instead of truncating tables.
 */
@SpringBootTest
@TestPropertySource(properties = {"app.scheduling.enabled=false", "app.web-origin=http://localhost:3000"})
public abstract class PostgresIntegrationTest {
    @ServiceConnection
    protected static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18.6");
    static { POSTGRES.start(); }

    @Autowired protected JdbcTemplate jdbc;

    protected UUID guest() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO app_user(id,email,password_hash,full_name) VALUES(?,?,?,?)", id, "guest-" + id + "@example.com", "{noop}unused", "Test Guest");
        jdbc.update("INSERT INTO user_role(user_id,role) VALUES(?, 'GUEST')", id);
        return id;
    }

    protected UUID approvedHotel() {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO hotel(id,name,slug,address,city,country,status) VALUES(?,?,?,?,?,?,'APPROVED')", id, "Hotel " + id, "hotel-" + id, "1 Test Street", "Phnom Penh", "Cambodia");
        return id;
    }

    protected UUID roomType(UUID hotel, String name, int capacity, String basePrice) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO room_type(id,hotel_id,name,capacity,base_price,currency) VALUES(?,?,?,?,?,'USD')", id, hotel, name, capacity, new BigDecimal(basePrice));
        return id;
    }

    protected UUID room(UUID hotel, UUID roomType, String number) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO room(id,hotel_id,room_type_id,room_number) VALUES(?,?,?,?)", id, hotel, roomType, number);
        return id;
    }
}
