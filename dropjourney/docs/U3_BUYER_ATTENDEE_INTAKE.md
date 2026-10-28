# DJ-U3 — Verified third-party intake handoff (2026-10-28)

**Entry:** U1 and U2 PASS, 16-page isolated test Worker. **Objective:** replace inert buyer application and ticket notification dead ends with actual, event-specific secure form destinations, without adding personal-data storage or write APIs to the preview Worker.

## Existing provider capability and new assets

- Existing enabled INFUSED contact Jotform remains `262867873887079` with its published source route; CannaCon Hosted Buyer `262642521146048` and Attendee Registration `262665252358059` are **not** appropriate for INFUSED and remain untouched.
- Created `INFUSED Hosted Buyer Request — Preview Intake`: `https://form.jotform.com/263005621560043`. Fields include professional identity, buying authority, sourcing priorities, mandatory inquiry consent, independent unchecked marketing opt-in and hCaptcha. Tool fetch reported enabled and 0 submissions. **External provider Jotform, not first-party storage.**
- Created `INFUSED Attendance Interest — Preview Intake`: `https://form.jotform.com/263005581843052`. Name/email, role, interest categories, mandatory event-specific consent, optional newsletter opt-in, CAPTCHA. Ticket admission is not sold, reserved or guaranteed. Tool fetch reported enabled and 0 submissions.
- Live Jotform DOM inspection found required consent widgets (`jf-required`) on each, separate optional marketing widgets and CAPTCHA. This is not a verified end-to-end receipt or data-retention policy audit.

## Website changes

- Retired source homepage's six-step non-submitting modal; WHO now routes directly to the standalone buyer request page, not the old preview. The buyer request page no longer asks visitors to enter information twice, and presents a clearly labeled externally hosted form. The original source six-step form is removed from the active site build; the preview Worker remains GET/HEAD only.
- Attendee Tickets still says **tickets not on sale** while offering the separate consent-based attendance updates request, not ticket registration.
- External handoffs open in a separate browser tab with `rel=noopener noreferrer`, `referrerpolicy=no-referrer`; no personal values in URLs, no UTM prefill, no preview-D1 writes and no changes to production.
- Contact and booth checkout retained.

## U3 acceptance

**Completed design/technical gates:** both Jotform forms exist and are enabled; dedicated routes correctly link to distinct assets; mandatory consent/bot controls exist in page source; no native PII form or duplicated wizard remains in the preview; attendance CTA explicitly distinguishes interest from tickets; smoke-test links load via 200 responses.

**Required before production use:** an authorized synthetic submission to each form and received receipt, provider notification/retry/de-duplication behavior, verified privacy/retention/marketing-automation configuration, and approval of final consent text. Do not claim form response or duplicate prevention tested simply because Jotform shows ENABLED. If those remain unverified, U3 exits **PARTIAL** and production integration remains blocked; no real payments or emails are authorized.

**Next:** U3.1 acceptance of provider configuration and QA receipt, then U4 event-gravity editorial work. No production cutover.
