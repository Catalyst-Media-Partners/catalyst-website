# DJ-S01: Trusted baseline and content lock
Date: 2026-10-27
Status: EVIDENCE CAPTURED; ACCEPTANCE GATE PENDING EDITORIAL FACT SIGN-OFF

## Source control and immutable production checkpoint
- Authoritative code: `Catalyst-Media-Partners/catalyst-website`, branch `infused-show`, commit `891e895913b6432162b4aa27fd49df6cc918fdbe`, tree `55812022bde6ff982ea97104f2dd22c415b2ec04`.
- GitHub CI: https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/39854333926 (success, source commit matches production).
- Cloudflare production Worker: `infused-show` version `f69bd0ee-3ad0-4bbb-8bc9-d756a70bfb2a`; deployment `c79682ae-15cf-420e-88d9-6dc7e8a6558e` at 2026-10-22T21:05:29Z, 100% Wrangler.
- S01 source branch: `dj/s01-trusted-baseline-20261027`, created from exact production commit. No commits to production branch.
- Google Drive release folder: https://drive.google.com/drive/folders/1jPWg_ynarOZyiYUshDofHiLRlHS9lRQZ .
- v1b.2 immutable source ZIP: https://drive.google.com/file/d/1DCIc0mKFd6rgznMZg-dTdT605unfX6hQ/view ; SHA256 `e78568f84b2f7705a8e4a69142414511eb009fc18d5ca76feafc269c9a7050fc`. This is a HISTORICAL checkpoint **15 commits behind current production**, not the production source baseline.
- Rebuilt the original v1b.2 ZIP unmodified: `npm run build`, `npm run check`, and `node scripts/verify-cloudflare.mjs` passed (14 pages, 144 internal destinations, 53 media references); this checks the historical archive ONLY.
- Live three-ring Drop Journey: isolated Worker `infused-dropjourneytest`, v1.5.0, last deployment `24db0bfa-e369-43d0-b17f-9acb3e078cc7` (2026-10-27T18:30:10Z); original source ZIP SHA256 `b134b59331d75ba1f9002c70419402058416ea0b7c94fee5c3b6440f3a628665`. 46 previously reported structural checks, public 3-ring effect browser tests documented in source `DEPLOYMENT_RECEIPT.json`. Creative starting point, not production source of truth.

## Content parity
Required current public pages (15): `/`, `/market/`, `/ecosystem/`, `/roots/`, `/science/`, `/make/`, `/package/`, `/move/`, `/sell/`, `/services/`, `/buyers/`, `/why-vegas/`, `/opportunities/`, `/contact/`, `/tickets/`.
Each maps to `/dropjourneytest/` plus its current relative path. New gated buyer application may be `/dropjourneytest/buyers/apply/`. Fourteen current pages have the same general section roots as v1b.2; ticket notifications were added to production later. Current production HEAD, not v1b.2, governs factual parity.

Evidence: `2026-10-27-live-page-snapshots.json` includes Cloudflare Browser Rendering excerpts for every public route (NOT complete copies: provider output is truncated; preserve full source from GitHub for exact text). Do not rely on the excerpt SHA as a full-document fingerprint. HTML source and updated assets should be compared against production commit during S02-S10.

## Unresolved factual claims (not permission to make up data)
1. Event **May 13-14, 2027** and Las Vegas Convention Center are publicly displayed and in production GitHub marketing release, but signed/official event-operations confirmation was not independently reviewed.
2. Inline 10x10 **from $3,000** and corner **from $3,500** are publicly displayed; validate current Map Dynamics order inventory and sales authorization before new publication.
3. Published **25% early-bird ticket offer**, but signup **disabled** pending confirmed SES delivery, Turnstile, D1 migration, sender, consent and discount implementation.
4. Hosted-buyer application is a **non-submitting prototype**, without approved collection endpoint, consent/retention terms or VIP benefit guarantees.
5. Public five market claims need their source-year, geography, overlap warning and original outbound source URLs retained.
6. Twenty-one historical site images exist; rights/approvals and claims of actual show photography require evidence before redesign uses them as authentic event imagery.

## Protected integration and routing boundary
- Live domain Worker `infused-show` has `ASSETS` and D1 `AUDIENCE_DB` bindings. Do not expose or copy any secrets or PII, or modify D1 schemas/settings as part of redesign.
- First-party `/go/booth` records anonymous clicks and redirects to Map Dynamics at unchanged vendor URL unless a distinct approved forwarding flag is enabled. Preserve this handler and its attribution; no Stripe, discount or sales portal changes.
- Ticket endpoints `/tickets/`, `/tickets/api/*` and verification/unsubscribe flow must remain under the current Worker untouched.
- DNS and HTTPS Custom Domains still owned by `infused-show`; only preview zone route `infused.show/dropjourneytest*` attached to `infused-dropjourneytest`.
- Note: the existing wildcard pattern also matches `/dropjourneytestanything`; preview Worker should fail closed on unexpected suffixes, and future route hardening is a planned S03 task. Do not broaden access.
- Every HTML page beneath `/dropjourneytest/` must have `noindex, nofollow, noarchive` HTTP header and meta tag; no addition to sitemap. All internal links stay under test prefix. Preserve production CSP, privacy controls, 21+ acknowledgement where applicable.
- Test Worker rollback: retain prior Worker version/deployment IDs, roll back only `infused-dropjourneytest`, and preserve existing production Worker and host bindings.

## Acceptance receipt
- DJ-S01-01: **PASS on authoritative identity and CI lineage**, partial on full immutable current source archive (immutable Git SHA is verified; historical ZIP is not current production; current full ZIP not yet archived).
- DJ-S01-02: **PARTIAL** route map 15/15 and base-page snapshot excerpts captured; full current-source per-page content/image/citation comparison remains pending.
- DJ-S01-03: **PARTIAL** fact/source register and protected statuses documented; signed event, live price, ticket offer and buyer program approvals pending.
- DJ-S01-04: **PASS on production boundaries identified**, partial on end-to-end rollback simulation for future multipage test deployment.

**DO NOT PROMOTE S01 TO APPROVED/CLOSED** until current production archive with manifest + acceptance receipt and owner factual approvals are complete. S02 may explore isolated designs with expressly unconfirmed claims held out, but no fact-changing public releases.

## Next steps
- Archive current `infused-show` Git SHA contents to a full, independently reproducible `DJ_S01_prod_891e895_source.zip` using a trusted clone or GitHub archive, and verify full-build CI. Do not manufacture this baseline by rebuilding old v1b.2 with speculative changes.
- Replace excerpt snapshots with complete current page captures (or exact source-generated HTML) and fill the 15-route content matrix from production SHA.
- Approve current date/venue, booth prices, ticket offer/operational status and buyer program intake/privacy; record source and approver, not assumptions.
- S02 starts from current `infused-show` commit and verified v1.5 Drop Journey independently, preserving the production boundary.
