ALTER TABLE notification
    ADD COLUMN payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN read_at timestamptz;

CREATE INDEX notification_user_inbox_idx
    ON notification(user_id, created_at DESC)
    WHERE channel = 'IN_APP';

ALTER TABLE notification
    ADD COLUMN attempts integer NOT NULL DEFAULT 0,
    ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now(),
    ADD COLUMN last_error text,
    ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX notification_email_outbox_idx
    ON notification(next_attempt_at, created_at)
    WHERE channel = 'EMAIL' AND status IN ('PENDING','PROCESSING');
