package com.stayease.integration;

import com.stayease.support.PostgresIntegrationTest;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.Arrays;
import static org.junit.jupiter.api.Assertions.*;

/** The application context only starts if Hibernate's ddl-auto=validate accepts the migrated schema. */
class SchemaMigrationIntegrationTest extends PostgresIntegrationTest {
    @Autowired Flyway flyway;

    @Test void appliesEveryVersionedMigrationSuccessfullyWithNothingPending() {
        var info = flyway.info();
        assertEquals(0, info.pending().length, "pending migrations");
        assertTrue(info.applied().length >= 9, "expected V1..V9 to be applied");
        assertTrue(Arrays.stream(info.applied()).allMatch(m -> m.getState() == MigrationState.SUCCESS),
            () -> Arrays.toString(Arrays.stream(info.applied()).map(m -> m.getVersion() + ":" + m.getState()).toArray()));
    }

    @Test void doesNotLoadLocalDemoSeedOutsideTheLocalProfile() {
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE version='900'", Integer.class));
    }

    @Test void installsTheInventoryAndBookingInvariants() {
        assertEquals("x", jdbc.queryForObject("SELECT contype::text FROM pg_constraint WHERE conname='room_occupancy_no_overlap'", String.class), "GiST exclusion constraint");
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM pg_extension WHERE extname='btree_gist'", Integer.class));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM pg_trigger WHERE tgname IN ('reservation_requires_room_line','reservation_room_line_required_on_delete') AND tgdeferrable AND tginitdeferred", Integer.class));
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM pg_constraint WHERE conrelid='reservation'::regclass AND contype='u' AND pg_get_constraintdef(oid) LIKE '%guest_id, idempotency_key%'", Integer.class));
    }

    @Test void migrationsAreRepeatableOnAnAlreadyMigratedDatabase() {
        var result = flyway.migrate();
        assertEquals(0, result.migrationsExecuted);
        assertTrue(flyway.validateWithResult().validationSuccessful);
    }
}
