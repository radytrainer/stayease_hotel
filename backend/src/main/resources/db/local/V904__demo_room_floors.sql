-- Local/demo data only. Derive floors for demo rooms from their numbers: "204" is on floor 2 and
-- "1" to "99" are ground-floor (0) rooms. Lettered rooms such as villas "V1" and bungalows "B2" stay without a floor.
UPDATE room SET floor = CASE
  WHEN room_number ~ '^[0-9]{3,4}$' THEN (room_number::int / 100)
  WHEN room_number ~ '^[0-9]{1,2}$' THEN 0
END
WHERE id::text LIKE '30000000-0000-4000-8000-%';
