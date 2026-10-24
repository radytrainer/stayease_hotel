-- Discount codes owned by one hotel. A code applies to bookings MADE between starts_on and ends_on (inclusive,
-- either may be open), for stays of at least min_nights. Uses are counted from live reservations, so an expired
-- or cancelled booking gives its use back.
CREATE TABLE promotion_code (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id uuid NOT NULL REFERENCES hotel(id) ON DELETE CASCADE,
    code varchar(32) NOT NULL CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
    description varchar(200),
    discount_type varchar(10) NOT NULL CHECK (discount_type IN ('PERCENT','FIXED')),
    discount_value numeric(19,4) NOT NULL CHECK (discount_value > 0),
    currency char(3),
    starts_on date,
    ends_on date,
    min_nights integer NOT NULL DEFAULT 1 CHECK (min_nights BETWEEN 1 AND 60),
    max_uses integer CHECK (max_uses > 0),
    one_per_guest boolean NOT NULL DEFAULT true,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, code),
    CHECK (discount_type <> 'PERCENT' OR discount_value <= 100),
    CHECK (discount_type <> 'FIXED' OR currency IS NOT NULL),
    CHECK (starts_on IS NULL OR ends_on IS NULL OR ends_on >= starts_on)
);

-- total_amount stays what the guest pays; subtotal and discount explain it on receipts and reports.
ALTER TABLE reservation ADD COLUMN promotion_code_id uuid REFERENCES promotion_code(id);
ALTER TABLE reservation ADD COLUMN subtotal_amount numeric(19,4) CHECK (subtotal_amount >= 0);
ALTER TABLE reservation ADD COLUMN discount_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0);
UPDATE reservation SET subtotal_amount = total_amount WHERE subtotal_amount IS NULL;
CREATE INDEX reservation_promotion_idx ON reservation(promotion_code_id) WHERE promotion_code_id IS NOT NULL;
