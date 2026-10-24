ALTER TABLE reservation ADD COLUMN guest_count integer NOT NULL DEFAULT 1 CHECK(guest_count BETWEEN 1 AND 20);
