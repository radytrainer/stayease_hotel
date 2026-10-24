ALTER TABLE payment ADD COLUMN checkout_url text;
ALTER TABLE payment ADD COLUMN provider_payment_reference varchar(240);
ALTER TABLE payment DROP CONSTRAINT payment_status_check;
ALTER TABLE payment ADD CONSTRAINT payment_status_check CHECK(status IN ('CREATED','PENDING','AUTHORIZED','SUCCEEDED','DECLINED','FAILED','REFUNDED'));
CREATE TABLE payment_reconciliation (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES payment(id), action varchar(24) NOT NULL CHECK(action IN ('REFUND_LATE_SUCCESS')), provider_reference varchar(240) NOT NULL, idempotency_key varchar(160) NOT NULL UNIQUE, status varchar(24) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SUCCEEDED','FAILED')), attempts integer NOT NULL DEFAULT 0, last_error text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
