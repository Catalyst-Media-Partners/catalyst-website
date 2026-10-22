# INFUSED W02 | Standalone ticket notifications update

Source: current October 20 INFUSED infused-show commit 1c35bef, preserving independent Worker /go/booth attribution, Map-D vendor checkout and latest CSS/navigation. W02 design pages derive from the approved October 14 v1b.2 branding.
W02 includes /tickets/ registration interest, one-time email confirmation, unsubscribe, and 25% early-bird eligibility messaging. A valid discount code is not issued until ticket products go live.

Design: Reuse original site CSS, original header, original footer, image assets and typography. Only ticket-specific CSS is additive. Removed "FROM ROOTS TO RETAIL" hero-promise badge from the verification success page by user request. The brand tagline remains elsewhere on the site.

Safety: Preserve current booth CTA first-party acquisition tracking /go/booth, existing D1 AUDIENCE_DB binding, external Map-D checkout, CannaCon and Catalyst routes, secrets and DNS.

Production prerequisites before enabling Notify Me:
* Apply the additive migrations/0001_infused_notify.sql to the existing INFUSED Worker AUDIENCE_DB binding after confirming its schema and obtaining a rollback/backup. Only the ticket_notify_ tables are added; do not change other tables.
* Configure INFUSED_NOTIFY_ENABLED=true (only after successful live test), TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY, RATE_SALT, MAILING_ADDRESS and SES credentials/region verified for joe@infusedvegas.com in the protected INFUSED Worker runtime.
* Verify sender/DKIM/Mail-From, real test send, verification and unsubscribe, including list-unsubscribe headers and mailbox ownership.
* Verify real registration and consent in production. Until then, signup is disabled by the Worker and no verification emails are sent.
* Update CannaCon LV27 ticket links only after /tickets/ can accept working subscriptions.

QA: npm run build, npm run check, node scripts/verify-cloudflare.mjs, node --test tests/w02-notify.test.mjs. Responsive preview 1440, 1024, 768, 390px. Mail sending only simulated in tests; no live email in this staging change.

Rollback: Revert this pull request on infused-show. Generated public/ excluded as always. Never override protected secrets, production routes, or existing booth checkout integration.
