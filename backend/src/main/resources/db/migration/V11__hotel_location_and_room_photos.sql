-- Map pin for each hotel. Optional, but both coordinates are set together and must fall inside Cambodia.
ALTER TABLE hotel
  ADD COLUMN latitude numeric(9,6),
  ADD COLUMN longitude numeric(9,6),
  ADD CONSTRAINT hotel_location_pair CHECK ((latitude IS NULL) = (longitude IS NULL)),
  ADD CONSTRAINT hotel_location_in_cambodia CHECK (latitude IS NULL OR (latitude BETWEEN 9.5 AND 14.8 AND longitude BETWEEN 102.2 AND 107.8));

-- Photos of a room type, grouped so guests can see the room, bathroom, view and outside of the building.
CREATE TABLE room_type_image (
  id uuid PRIMARY KEY,
  room_type_id uuid NOT NULL REFERENCES room_type(id) ON DELETE CASCADE,
  object_key text NOT NULL,
  content_type varchar(80) NOT NULL,
  alt_text varchar(250),
  category varchar(16) NOT NULL CHECK (category IN ('ROOM','BATHROOM','VIEW','EXTERIOR')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX room_type_image_type_idx ON room_type_image(room_type_id, category, sort_order);
