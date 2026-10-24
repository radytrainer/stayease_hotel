-- Photos may be hotlinked from Unsplash (required by Unsplash's API guidelines) instead of stored in our bucket.
-- Only Unsplash's image CDN is allowed, and such photos must carry the photographer credit.
ALTER TABLE hotel_image
  ALTER COLUMN object_key DROP NOT NULL,
  ADD COLUMN source_url text,
  ADD COLUMN credit_name varchar(200),
  ADD COLUMN credit_url text,
  ADD CONSTRAINT hotel_image_has_source CHECK ((object_key IS NOT NULL) <> (source_url IS NOT NULL)),
  ADD CONSTRAINT hotel_image_external_is_unsplash CHECK (source_url IS NULL OR (source_url LIKE 'https://images.unsplash.com/%' AND credit_name IS NOT NULL AND credit_url LIKE 'https://unsplash.com/%'));

ALTER TABLE room_type_image
  ALTER COLUMN object_key DROP NOT NULL,
  ADD COLUMN source_url text,
  ADD COLUMN credit_name varchar(200),
  ADD COLUMN credit_url text,
  ADD CONSTRAINT room_type_image_has_source CHECK ((object_key IS NOT NULL) <> (source_url IS NOT NULL)),
  ADD CONSTRAINT room_type_image_external_is_unsplash CHECK (source_url IS NULL OR (source_url LIKE 'https://images.unsplash.com/%' AND credit_name IS NOT NULL AND credit_url LIKE 'https://unsplash.com/%'));
