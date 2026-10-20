# INFUSED Las Vegas: first-party acquisition click measurement (Phase 1)

## Deliverable
A fixed first-party `/go/booth` route records a sanitized, anonymous click in the existing Catalyst D1 database, then redirects to the same Map D registration flow already used by the site. The site enhances its existing CTA anchors with this route and propagates UTM source, medium, campaign, content and term across its own pages without a cookie or browser storage.

## Design boundary
- This captures **booth CTA clicks, not paid purchases or unique visitors**.
- No email, contact ID, full referrer URL, IP address, user agent or fingerprint is stored.
- Campaign parameters are untrusted claims and cannot establish buyer identity, sales attribution or marketing permission.
- On production hosts, a successful D1 write creates a random, opaque click ID. **By default, Map D receives its original URL unchanged.** Forwarding the ID and sanitized UTM tags is implemented but feature-gated by `MAPD_CLICK_ID_FORWARD_ENABLED=true`, pending a vendor checkout-compatibility test.
- **Map D persistence of `catalyst_click_id` into its orders is not verified**. No conversion-to-click joins may be claimed or automatically inferred. Verify the downstream field before implementing verified order attribution.
- On preview hosts, when D1 is absent, or when logging fails, visitors retain the original purchase URL without a tracking token.
- No inventory, payment, discount, checkout pricing or consent settings are changed.

## Production dependencies
1. The authoritative forward-only schema lives in `Catalyst-Media-Partners/catalyst-event-data/migrations/0008_lv27_first_party_clicks.sql`. Apply and verify it in D1 **before merging and publishing this site change**.
2. The `infused-show` Worker is bound to the existing `catalyst-audience-prod` D1, with access restricted by code to one prepared INSERT.
3. Review the public privacy disclosures before expanding beyond anonymous first-party click measurements, or connecting campaigns to identifiable people.

## QA and release
- GitHub CI: normal 14-page build, link checks, Cloudflare routing, responsive Chromium checks, synthetic Worker D1 unit tests, and browser UTM/link propagation QA.
- Confirm a real website click produces exactly one `web_acquisition_clicks_v1` record; the redirect still permits selecting and purchasing a booth in Map D.
- Inspect the resulting Map D order for a *persisted* `catalyst_click_id` before attempting any buyer/order attribution. If the vendor drops it, implement a vendor-supported order reference mechanism rather than relying on company names, timing proximity or email matching.
- No automatic outbound email or marketing campaign is launched by this patch.
- Merge into `infused-show` only after CI is green and the D1 migration has been applied. Existing owner-gated deployment controls remain unchanged.

## Rollback
Revert the website PR. The additive click ledger can remain empty and unused; drop it only under a reviewed migration after any retention/audit needs are addressed.
