-- Administrator promotions: hotel_id NULL means the code works at every approved hotel. Featured promotions are
-- advertised on the home page while they are bookable (starts_on..ends_on), so seasonal and holiday offers can be
-- prepared in advance and appear and disappear on their own.
ALTER TABLE promotion_code ALTER COLUMN hotel_id DROP NOT NULL;
ALTER TABLE promotion_code ADD COLUMN headline varchar(80);
ALTER TABLE promotion_code ADD COLUMN theme varchar(24) NOT NULL DEFAULT 'GENERAL'
    CHECK (theme IN ('GENERAL','KHMER_NEW_YEAR','PCHUM_BEN','WATER_FESTIVAL','INTERNATIONAL_NEW_YEAR','GREEN_SEASON','HIGH_SEASON'));
ALTER TABLE promotion_code ADD COLUMN featured boolean NOT NULL DEFAULT false;
-- UNIQUE(hotel_id, code) ignores NULLs, so platform codes need their own uniqueness.
CREATE UNIQUE INDEX promotion_code_platform_code_idx ON promotion_code(code) WHERE hotel_id IS NULL;
CREATE INDEX promotion_code_featured_idx ON promotion_code(featured, active) WHERE hotel_id IS NULL;
