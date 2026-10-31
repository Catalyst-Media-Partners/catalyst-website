-- DJ-U3.4: purpose-limited, email-only ticket verification.
-- Apply to isolated infused-intake D1, NOT the canonical audience/checkout database.
-- Marketing consent is limited to requested ticket notifications, and is verified.
CREATE TABLE IF NOT EXISTS infused_ticket_notify_v1 (
 id TEXT PRIMARY KEY,
 email TEXT NOT NULL UNIQUE,
 email_domain TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','verified','unsubscribed')),
 verification_hash TEXT UNIQUE,
 verify_expires_at TEXT,
 unsubscribe_hash TEXT NOT NULL UNIQUE,
 mail_state TEXT NOT NULL DEFAULT 'queued' CHECK(mail_state IN ('queued','sending','sent','uncertain')),
 mail_attempts INTEGER NOT NULL DEFAULT 0,
 mail_sent_at TEXT,
 ses_message_id TEXT,
 promo_code TEXT UNIQUE,
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 verified_at TEXT,
 unsubscribed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_infused_ticket_verify_hash_v1 ON infused_ticket_notify_v1(verification_hash);
CREATE INDEX IF NOT EXISTS idx_infused_ticket_state_v1 ON infused_ticket_notify_v1(state,verified_at);
CREATE TABLE IF NOT EXISTS infused_ticket_notify_rate_v1 (
 key_hash TEXT NOT NULL,
 hour_bucket INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(key_hash,hour_bucket)
);
-- Old rate buckets can be purged as housekeeping; do not purge verified consent by default.
