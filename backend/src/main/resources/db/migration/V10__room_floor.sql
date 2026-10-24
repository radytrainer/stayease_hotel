-- Floor of a physical room, shown to guests with their assigned room number and to reception.
-- Optional: villas and bungalows have no floor. 0 is the ground floor.
ALTER TABLE room ADD COLUMN floor smallint CHECK (floor BETWEEN -5 AND 200);
