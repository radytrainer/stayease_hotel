ALTER TABLE payment_reconciliation ADD COLUMN refund_amount numeric(19,4) NOT NULL DEFAULT 0 CHECK(refund_amount >= 0);
ALTER TABLE payment_reconciliation ADD COLUMN cancellation_id uuid REFERENCES cancellation(id);
ALTER TABLE payment_reconciliation ADD COLUMN refund_currency char(3) NOT NULL DEFAULT 'USD';
UPDATE payment_reconciliation w SET refund_currency=p.currency FROM payment p WHERE p.id=w.payment_id;
ALTER TABLE payment_reconciliation ALTER COLUMN refund_currency DROP DEFAULT;
ALTER TABLE payment_reconciliation DROP CONSTRAINT payment_reconciliation_action_check;
ALTER TABLE payment_reconciliation ADD CONSTRAINT payment_reconciliation_action_check CHECK(action IN ('REFUND_LATE_SUCCESS','POLICY_REFUND'));
