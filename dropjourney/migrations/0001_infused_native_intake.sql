-- DJ-U3: independent INFUSED D1 intake and operational SES notification queue.
-- Applied 2026-10-28 to Cloudflare D1 infused-intake (US jurisdiction).
CREATE TABLE IF NOT EXISTS intake_submissions_v1 (
 id TEXT PRIMARY KEY,
 request_key TEXT NOT NULL UNIQUE,
 kind TEXT NOT NULL CHECK(kind IN ('buyer','attendee','contact')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 full_name TEXT NOT NULL,
 email TEXT NOT NULL,
 company TEXT NOT NULL DEFAULT '',
 job_title TEXT NOT NULL DEFAULT '',
 buying_role TEXT NOT NULL DEFAULT '',
 categories_json TEXT NOT NULL DEFAULT '[]',
 objective TEXT NOT NULL DEFAULT '',
 website TEXT NOT NULL DEFAULT '',
 markets TEXT NOT NULL DEFAULT '',
 message TEXT NOT NULL DEFAULT '',
 inquiry_topic TEXT NOT NULL DEFAULT '',
 consent_contact INTEGER NOT NULL DEFAULT 1 CHECK(consent_contact=1),
 consent_marketing INTEGER NOT NULL DEFAULT 0 CHECK(consent_marketing IN (0,1)),
 consent_version TEXT NOT NULL,
 source_page TEXT NOT NULL,
 environment TEXT NOT NULL DEFAULT 'preview',
 form_version TEXT NOT NULL DEFAULT 'u3-native-1',
 test_record INTEGER NOT NULL DEFAULT 0 CHECK(test_record IN (0,1))
);
CREATE TABLE IF NOT EXISTS intake_notification_outbox_v1 (
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
CREATE INDEX IF NOT EXISTS idx_infused_intake_created_v1 ON intake_submissions_v1(created_at);
CREATE INDEX IF NOT EXISTS idx_infused_intake_kind_v1 ON intake_submissions_v1(kind,created_at);
CREATE INDEX IF NOT EXISTS idx_infused_outbox_pending_v1 ON intake_notification_outbox_v1(state,next_attempt_at);
