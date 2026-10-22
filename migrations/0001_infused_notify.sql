-- Isolated INFUSED ticket notification list. Never stores Gmail contents or payment data.
CREATE TABLE IF NOT EXISTS ticket_notify_subscribers (
 email TEXT PRIMARY KEY COLLATE NOCASE,
 email_domain TEXT NOT NULL,
 state TEXT NOT NULL CHECK (state IN ('pending','verified','unsubscribed')),
 verification_hash TEXT UNIQUE,
 verification_expires_at TEXT,
 unsubscribe_hash TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL,
 verification_sent_at TEXT,
 verified_at TEXT,
 unsubscribed_at TEXT,
 source TEXT NOT NULL DEFAULT 'infused.show/tickets'
);
CREATE INDEX IF NOT EXISTS idx_infused_notify_state ON ticket_notify_subscribers(state);
CREATE TABLE IF NOT EXISTS ticket_notify_rate (
 key_hash TEXT NOT NULL,
 hour_bucket INTEGER NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY (key_hash, hour_bucket)
);
