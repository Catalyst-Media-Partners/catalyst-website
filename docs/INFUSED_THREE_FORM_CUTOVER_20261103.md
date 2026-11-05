# INFUSED 3-form production cutover | 2026-11-03

This release extends the approved INFUSED dark Drop Journey design and existing native intake, rather than adding Jotform embeds or a new Worker.

## Source changes
- `dropjourney/src/intake-form.mjs`: three purpose-built Contact, Hosted Buyer, Attendance Interest form patterns. No unrelated marketing/subscription or duplicative contact-consent checkbox.
- `dropjourney/src/intake.js`: same-origin submission, required Turnstile, accurate input handling, clean success messages, optional website URL normalization.
- `dropjourney/intake.mjs`: data validation, consent separation, D1 atomic insert with two idempotent SES outboxes, dispatcher polling both.
- `dropjourney/build.mjs`: new addressable `/attend/interest/` page and sitemap; existing `/contact/` and `/buyers/apply/` kept.
- `dropjourney/src/s09-pages.mjs`: link from tickets to attendance interest without turning on ticket notification.
- `dropjourney/src/finish.css`: use official plum/acid palette and responsive form grids.
- `dropjourney/scripts/qa*.mjs` and `visual_qa.py`: structural/logic/visual validations across widths.

## Production prerequisites
- Revenue backend migration `services/catalyst-revenue/migrations/0034_infused_intake_ack_outbox.sql` applied and verified in `catalyst-audience-prod`.
- Revenue SES bridge updated to send staff and customer messages as independent transactions.
- Production must continue to use reviewed `infused-dark` Worker, `keep_vars=true`, service binding `INTAKE_SES -> catalyst-revenue`, `INTAKE_DB -> catalyst-audience-prod`, site base `/`, and `TICKET_NOTIFY_ENABLED=false`.
- Website production deployment via unchanged guarded GitHub Actions workflow; no DNS or secrets mutation.

## Acceptance
- Three form pages load directly, have one H1 and accessible labels, no marketing consent, and show the approved INFUSED logo/palette.
- Successful submission yields a brief on-page thank-you and independently delivered requestor and employee SES messages.
- Staff reply links address the submitting person with a reference in the subject.
- Customer acknowledgments contain only relevant fields. No ticket, acceptance, sponsorship, marketing, invoice, or sales entitlement is implied.
- Personal information remains in canonical D1; no source-page, UUID/UTM/technical log on employee or requestor emails.

## 2026-11-05 contact-consent correction
- The three first-party inquiry forms now show an explicit, unchecked, required contact permission checkbox immediately before Turnstile.
- The client submits the actual checkbox state; the server continues to reject missing consent and keeps marketing consent false.
- A versioned intake JavaScript URL avoids stale client assets after release. Updated acceptance and responsive QA enforce the visible consent field.
- No changes to D1 schema, SES routing, domains, Stripe, secrets, or the guarded production release workflow.
