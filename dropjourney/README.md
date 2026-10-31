# INFUSED Drop Journey | Single-Worker production source

The Drop Journey is the primary INFUSED brand experience. The original light experience is one landing page within the same site, not a second website or Worker.

## Current domain and Worker architecture

| Hostname / path | Experience | Routing |
|---|---|---|
| infused.show/ | Dark-green Drop Journey | The single public infused-dark Worker |
| infused.show/lander/ | Original light landing page | Static lander/index.html in the same Worker asset bundle |
| www.infused.show | Canonical alias | 308 redirect to infused.show |
| dark.infused.show | Dark alias | Same Worker; noindex and canonicalized to apex |
| light.infused.show | Retired hostname alias | Same Worker; 308 redirect to https://infused.show/lander/ |

There is no infused-show website Worker. The light page is built from the existing root src/ source, copied into dropjourney/dist/{mode}/lander/index.html, and served by the same ASSETS binding as the dark site. It uses the same /assets/images/ files, plus the light site's /assets/css/site.css and /assets/js/cta-attribution.js. Its base points to the current site root so its navigation continues into the dark site's pages.

Booth attribution is implemented in dropjourney/booth-attribution.mjs and called directly by dropjourney/worker.mjs. It uses the existing INTAKE_DB binding to catalyst-audience-prod; there is no BOOTH_ATTRIBUTION service binding or second audience database. The only Worker service binding is INTAKE_SES to the shared catalyst-revenue backend.

## Source of truth

- Repository: Catalyst-Media-Partners/catalyst-website.
- Production source branch: infused-show. It contains both the light landing-page source and the Drop Journey source.
- Production Worker: infused-dark.
- Production D1: catalyst-audience-prod, ID 4fc7440c-bacd-4ef2-8902-265eda67e4d1.
- The root wrangler.toml is the only production Worker configuration.
- The former deploy-infused.yml, dark canary workflow, separate Worker templates, and preview Worker configuration are retired. A single validated workflow deploys the public site.

## Build and QA

Run from the repository root:

    npm run build
    npm run check
    npm run test:w02
    INFUSED_MODE=production node dropjourney/build.mjs
    INFUSED_MODE=production node dropjourney/scripts/qa.mjs
    node dropjourney/scripts/qa_dark_worker.mjs
    node scripts/verify-cloudflare.mjs

The Drop Journey build requires the root light-site build first because it embeds the generated light homepage and copies its CSS and attribution script into the shared asset directory. Generated public/ and dropjourney/dist/ output are not edited manually.

## Production configuration and protected integrations

- One D1 binding: INTAKE_DB -> catalyst-audience-prod.
- One service binding: INTAKE_SES -> catalyst-revenue / InfusedIntakeSESBridge.
- Turnstile secrets remain encrypted Worker secrets and are preserved by keep_vars = true.
- TICKET_NOTIFY_ENABLED=false remains in production until its independent email-verification workflow passes end-to-end acceptance.
- Stripe, Map Dynamics checkout, Jotform, DNS and existing event facts are not changed by the single-Worker consolidation.

## Historical rollout notes

The remaining INF-1, INF-2, S03-S10 and DJ-X1 sections below are retained as historical acceptance records. Any instructions below that refer to a separate infused-show Worker, LIGHT_SITE or BOOTH_ATTRIBUTION service binding, infused-dropjourneytest, infused-intake, or infused-intake-production are superseded by the current architecture above and must not be executed.

## Visual/interaction QA
- Structural: all 16 pages, 21 images, no doubled route prefixes, one H1, privacy and Worker isolation checks.
- Representative browser passes: 1440, 1024, 768 and 390 CSS px; home chapter transitions, nav menu including Escape, buyer profile selection, page overflow and image loading.
- Follow-on S03-S10 acceptance covers page-by-page copy parity, complete focus/accessibility audit, real third-party commerce end-to-end and final editorial/content approvals. The S02 pass does not authorize production cutover.

## Rollback
Cloudflare retains prior `infused-dropjourneytest` Worker version IDs. Roll back that Worker only; leave the production `infused-show` Worker, host bindings and DNS untouched. The GitHub development branch tracks every S02 update.

## DJ-S03 | Navigation and water interaction release (2026-10-27)

- All 16 `/dropjourneytest/` pages remain generated from the authoritative INFUSED GitHub site source.
- Direct task paths, chapter URL history with UTM preservation, no-JS navigation, responsive no-side-scroll metrics and chapter selector.
- Restores three water menisci following pointer drag with single click/tap ripple; retains subtle droplet rebound. Motion activation buttons removed; system reduced-motion preference honored.
- New test: `node dropjourney/scripts/qa_s03.mjs` plus local responsive smoke `python dropjourney/scripts/qa_s03_smoke.py`.
- Preview CI workflow is on `.github/workflows/deploy-dropjourney-s03.yml` and can deploy **only** `infused-dropjourneytest`, preserving `infused-show` worker, assets, routing and secrets.
- Acceptance evidence and next sprint in `dropjourney/docs/S03_ACCEPTANCE.md`.

## DJ-S04 | Shared 3D droplet and editorial homepage (2026-10-27)

- Authoritative branch: `dj/s04-editorial-3d-water-20261027`, stacked on DJ-S03 (GitHub PR remains draft, no merge to production).
- `src/drop-art.svg` is the single shared smooth Bezier droplet artwork with layered diffuse/specular lighting and antialiased rim, expanded by `build.mjs` to the entrance and all five chapters.
- Detailed page photography gets soft editorial crops while chapter photography feathers rather than forming hard rectangles. No low-poly silhouettes, large animation framework, WebGL or added dependencies.
- WHY homepage summarizes three individually qualified examples; the full Market page keeps all five official published figures and source references. Chapter-specific CTAs and buyers/tickets links remain under `/dropjourneytest/` except existing `/go/booth` handoff.
- S04 QA: `node dropjourney/scripts/qa_s04.mjs` and local `python dropjourney/scripts/visual_s04.py`; results recorded in `docs/S04_ACCEPTANCE.md` and the GitHub S04 PR.
- Deploy workflow: `.github/workflows/deploy-dropjourney-s04.yml`. Only dedicated test Worker `infused-dropjourneytest` may be deployed; production is immutable.
- **Next S05:** Market and Las Vegas detail pages, source evidence hierarchy and image-led destination storytelling.

## DJ-S05 | Market Evidence and Vegas destination (2026-10-27)

- Branch: `dj/s05-market-vegas-evidence-20261027`, based on S04. Do not merge into production `infused-show`.
- `src/s05-pages.mjs` reorganizes the canonical Market/Why Vegas source without copying or inventing published market numbers, citations, original reasons or imagery. `src/s05.css` applies the responsive editorial system only to those two pages.
- `content/event.json` is the single preview source for the **currently published** event date, venue and city. Build fails if canonical site source conflicts with those values. Signed operator verification remains pending for any production cutover.
- `scripts/qa_s05.mjs` checks figure/source integrity, original Las Vegas copy and imagery, global date/venue parity and preview protection.
- **Next S06:** Ecosystem hub, Roots, Science, Make and Package.


## DJ-S06–S10 | Complete alternate site (2026-10-27)

- **Authoritative code and acceptance:** GitHub branch `dj/s06-s10-complete-preview-20261027`, reviewed against S05.
- **16-page preview:** https://infused.show/dropjourneytest/ under isolated Cloudflare `infused-dropjourneytest` Worker only. The primary INFUSED site is untouched.
- **S06:** `content/taxonomy.json`, `src/s06-pages.mjs`, `src/s06.css` for source-derived ecosystem, Roots/Science/Make/Package.
- **S07:** Same structured taxonomy for Move/Sell/Services, complete previous/next and buyer navigation.
- **S08:** `src/s08-pages.mjs` and `src/s08.css` for two-sided Hosted Buyer experiences; existing six-step wizard remains a local, non-submitting demo.
- **S09:** `src/s09-pages.mjs`, `src/s09.css` for full exhibit, sponsor, contact and tickets pages. Existing `/go/booth` and approved external Jotform only. Ticket subscriptions remain inactive.
- **S10:** `scripts/qa_s06.mjs` through `scripts/qa_s10.mjs`, isolated CI workflow and `docs/S10_RELEASE.md` preserve responsiveness, accessibility, integrity, noindex and rollback.
- Version `2.8.0-s10`. **No production cutover.** See `docs/S10_RELEASE.md` for acceptance evidence and remaining factual approvals.

## DJ-X1 | Site finishing and portable email landers

Source `dj/ux-finish-campaign-landers-20261028` stacked on the accepted S10 preview, **not production**.

- Final WHAT CTA directs the visitor to exhibit options. Make and Move have source-linked related imagery; opportunities and buyer profile have editorial photography; detail pages have clearer closing actions and consistent card wrapping.
- `content/landers.json` provides five approved fixed campaign offer variants, rendered with `src/landing-pages.mjs`, `src/landing.css`, `src/landing.js` as **standalone HTML** under `/dropjourneytest/land/<id>/`; generic `/land/` uses the discover variant.
- The same single-file outputs are emitted under `exports/landers/infused-<id>.html` and uploaded by the CI workflow for use with HTML-hosting platforms. Static destinations cannot be changed by URL input; UTMs pass through by allowlist. No forms, external scripts, or custom analytics.
- Light/dark are campaign styles, not duplicate canonical websites. Existing light production remains unchanged. Preview is `noindex`, not authenticated.
- New QA checks: `scripts/qa_finish.mjs` and `scripts/qa_campaign.mjs`. Audit and limitations in `docs/REVIEW_FINDINGS.md`.
- Version: `2.9.1-review`, isolated Cloudflare Worker `infused-dropjourneytest` only.

## DJ-X1.1 | Hosted Buyer conversion handoff (2026-10-28)

- Both the homepage buyer profile and standalone `/dropjourneytest/buyers/apply/` now offer a review-stage contact link to the existing preview Contact page, opened in a new tab after an optional explicit draft copy.
- The profile stays local: **no submission, persistence, automatic prefill, email, or API call**. The link does not transmit buyer inputs. A separately approved secure application destination is still required before turning the wizard into an intake.
- New assertions in `scripts/qa_finish.mjs` cover the two review stages, disclosure, fixed internal destination and retained copy control.
- Version `2.9.1-review` is a design-preview patch; it does not authorize production deployment.
