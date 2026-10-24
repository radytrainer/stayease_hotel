ALTER TABLE refund ALTER COLUMN cancellation_id DROP NOT NULL;
ALTER TABLE refund ADD COLUMN idempotency_key varchar(160);
CREATE UNIQUE INDEX refund_idempotency_key_idx ON refund(idempotency_key);
