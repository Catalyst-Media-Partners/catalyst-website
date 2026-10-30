# DJ-U3 — Native INFUSED intake: implementation and acceptance receipt

**Date:** October 28, 2026  
**Release:** `2.9.2-native-intake`  
**Scope:** isolated preview only at https://infused.show/dropjourneytest/  
**Acceptance:** **PASS** for native code and provider-backed D1 → private RPC → SES → inbox. **Open** for manual human Turnstile submission, privacy/retention review, public rate-limiting and production cutover.

## What is deployed

- Three first-party INFUSED forms: `/buyers/apply/` (Hosted Buyer), `/tickets/` (attendance-interest only), and `/contact/` (general inquiry).
- All 16 website routes and six campaign landing routes were browser-audited: **zero Jotform hrefs, scripts or embedded forms** in the preview; three native forms found. The **current production website still contains Jotform contact links** and was not changed.
- Same-origin JSON POST `/dropjourneytest/api/intake`: bounded payload, field validation, required inquiry consent, independent optional marketing consent (unchecked), bot honeypot, Cloudflare Turnstile with hostname/action verification.
- Separate US-jurisdiction Cloudflare D1 `infused-intake` (ID `13188d57-a463-445d-b341-9479ac3a4558`), versioned SQL migration `dropjourney/migrations/0001_infused_native_intake.sql`, canonical `intake_submissions_v1` and `intake_notification_outbox_v1` tables.
- Unique client UUID request key prevents duplicate intake/outbox inserts on lost-response retries. The private relay has a claim-and-send state machine; uncertain SES outcomes are held rather than blindly resent.
- Preview Worker bindings: `INTAKE_DB`, `INTAKE_SES` → `catalyst-revenue/InfusedIntakeSESBridge`, `TURNSTILE_SECRET`, static `ASSETS`. Notification retry schedule restored to `*/5 * * * *`.
- The private `catalyst-revenue` relay fetches the D1 receipt by UUID and delivers a fixed-recipient SESv2 HTML and plain-text summary. **From:** `intake@updates.cannacon.org`; **to:** `info@cannacon.org`; **Reply-To:** source email. Subject includes INFUSED request type, company/name, and `[TEST]` for test records. The summary includes form selections, inquiry, consent states, timestamp, source route and receipt ID.
- No AWS credentials are bound to the preview website; existing production revenue Worker encrypted SES credentials and audience D1 were preserved.
- No customer marketing campaign was launched; no tickets were sold or reserved.

## Accepted test evidence

1. Source PRs merged: [website #21](https://github.com/Catalyst-Media-Partners/catalyst-website/pull/21), [revenue #153](https://github.com/Catalyst-Media-Partners/catalyst-event-data/pull/153), and [lander metadata #22](https://github.com/Catalyst-Media-Partners/catalyst-website/pull/22). Exact-head PR CI passed before each merge.
2. Browser verified three native forms across mobile/desktop and 22/22 preview routes without Jotform dependencies. Ticket page still states tickets are not on sale. Website and landing-page versions both read `2.9.2-native-intake`.
3. Real preview HTTP negative tests: missing contact consent → **400**; missing Turnstile token → **403**; zero D1 writes on invalid submissions.
4. A clearly synthetic internal contact record `b7a687a7-159e-443a-a56b-b2a77b0131dd` with marketing consent false was inserted into D1 and its notification outbox once.
5. One-use QA Worker invoked the **deployed** private service binding for that fixed D1 receipt. Result: SES `accepted`, Message ID `010101a1843cb140-0dbae54a-5125-4673-8dec-7ec3f95a7cba-000000`.
6. D1 readback: `state=sent`, `attempts=1`, `sent_at=2026-10-28 20:38:52 UTC`, no error.
7. Gmail independently shows a received message at `info@cannacon.org` with subject **[TEST] [INFUSED Contact Inquiry] Catalyst internal synthetic QA — INFUSED QA Native Intake** and matching receipt details: [Gmail receipt](https://mail.google.com/mail/u/?authuser=lucas%40cannacon.org#all/1a1843cb8f1d257f).
8. Temporary one-use QA Worker disabled and deleted. Preview Cron restored to `*/5 * * * *`; no public arbitrary-email API remains.

## Cloudflare deployment boundaries

- Private revenue Worker: deployment `47638cf7-19c1-4634-acd3-132a78748e7f` (additive named entrypoint). Existing audience DB, encrypted SES credentials, rate limiter, four cron schedules and public routes preserved. Rollback to former version `3351baea-a489-405a-9dbb-89ec847a323a`.
- Preview Worker: integration branch `infused-preview`, deployed with version `2.9.2-native-intake`; PR #22 verified isolated deploy `5e7421db-5f33-4ae9-a585-e19326c87fbf` (may be superseded by documentation-only deploy).
- Existing production website Worker `infused-show` remains deployment `c79682ae-15cf-420e-88d9-6dc7e8a6558e`. **No production site cutover approved or executed.**

## Remaining production gates

1. Manually complete all three first-party forms in an authenticated regular browser, including legitimate Turnstile solve, then reconcile request receipt, D1 row and SES message once each.
2. Confirm abuse/rate-limit policy beyond Turnstile, privacy policy and retention/deletion processes, access to D1 PII, and optional marketing consent handling. Do not auto-subscribe inquiry records to marketing.
3. Confirm business claims: event dates, pricing, programming and ticket interest state.
4. Independently authorize and test production website cutover. Old production Jotform links must be replaced as part of that distinct deployment; historical Jotform submission records should be preserved for audit/reconciliation rather than deleted.
5. Instrument delivery/retry/uncertain-outcome reporting and confirm that every successful form receipt has one corresponding outbox record and an accountable terminal state.

**Next workstream:** DJ-U4 event-gravity / experience design after the above U3 operational follow-ups, without reopening the merged U3 code backlog.
