-- Mirror the production canonical INFUSED requestor acknowledgment queue for local QA.
CREATE TABLE IF NOT EXISTS intake_ack_outbox_v1 (
 submission_id TEXT PRIMARY KEY REFERENCES intake_submissions_v1(id),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','sending','retry','sent','failed','uncertain')),
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
 lease_until TEXT,
 ses_message_id TEXT,
 sent_at TEXT,
 last_error_code TEXT,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_infused_ack_pending_v1 ON intake_ack_outbox_v1(state,next_attempt_at);
