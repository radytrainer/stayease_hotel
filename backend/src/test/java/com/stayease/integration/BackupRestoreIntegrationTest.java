package com.stayease.integration;

import com.stayease.reservation.dto.ReservationCreateRequest;
import com.stayease.reservation.service.ReservationService;
import com.stayease.support.PostgresIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.Container;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;

/** Exercises the README procedure: pg_dump -Fc, then pg_restore --clean --if-exists into an empty database. */
class BackupRestoreIntegrationTest extends PostgresIntegrationTest {
    @Autowired ReservationService reservations;

    private Container.ExecResult exec(String... command) throws Exception {
        var result = POSTGRES.execInContainer(command);
        assertEquals(0, result.getExitCode(), () -> String.join(" ", command) + "\n" + result.getStderr());
        return result;
    }

    @Test void customFormatDumpRestoresDataAndEnforcedConstraints() throws Exception {
        UUID hotel = approvedHotel(), room = room(hotel, roomType(hotel, "Deluxe", 2, "100.00"), "101");
        LocalDate in = LocalDate.now().plusDays(70);
        var booked = reservations.create(guest(), new ReservationCreateRequest(hotel, in, in.plusDays(2), 1, List.of(room), UUID.randomUUID().toString()));

        String user = POSTGRES.getUsername(), restored = "restore_" + System.nanoTime();
        exec("pg_dump", "-U", user, "-Fc", "-f", "/tmp/stayease.dump", POSTGRES.getDatabaseName());
        exec("createdb", "-U", user, restored);
        exec("pg_restore", "--clean", "--if-exists", "--no-owner", "-U", user, "-d", restored, "/tmp/stayease.dump");

        var copy = new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl().replace("/" + POSTGRES.getDatabaseName(), "/" + restored), user, POSTGRES.getPassword()));
        for (String table : List.of("app_user", "hotel", "room", "reservation", "reservation_room", "room_occupancy", "reservation_status_history", "flyway_schema_history"))
            assertEquals(jdbc.queryForObject("SELECT count(*) FROM " + table, Long.class), copy.queryForObject("SELECT count(*) FROM " + table, Long.class), table);
        assertEquals(jdbc.queryForObject("SELECT nightly_rates::text FROM reservation_room WHERE reservation_id=?", String.class, booked.id()),
            copy.queryForObject("SELECT nightly_rates::text FROM reservation_room WHERE reservation_id=?", String.class, booked.id()));

        // The restored copy must still refuse a double booking, i.e. the exclusion constraint came back with the data.
        UUID extraLine = UUID.randomUUID();
        copy.update("INSERT INTO reservation_room(id,reservation_id,room_id,room_type_name,nightly_rates,line_total,currency) VALUES(?,?,?,'Deluxe','[]'::jsonb,0,'USD')", extraLine, booked.id(), room);
        var ex = assertThrows(Exception.class, () -> copy.update("INSERT INTO room_occupancy(reservation_room_id,room_id,stay) VALUES(?,?,daterange(?,?,'[)'))", extraLine, room, in.plusDays(1), in.plusDays(3)));
        assertTrue(ex.getMessage().contains("room_occupancy_no_overlap"), ex.getMessage());
    }
}
