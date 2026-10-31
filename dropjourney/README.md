# INFUSED Drop Journey | Production candidate

The Drop Journey is the planned primary INFUSED brand experience. The existing light experience remains a separate marketing journey. INF-1 prepares the dark production source and release configuration without changing production DNS or deploying a Worker.

## Domain architecture

| Hostname | Intended experience | INF-1 status |
|---|---|---|
| infused.show | Dark-green Drop Journey, canonical brand site | Source/build candidate prepared; root unchanged |
| dark.infused.show | Dark experience canary/alias | Configuration prepared; no DNS or custom domain assigned |
| light.infused.show | Existing light marketing experience | Existing Worker source now supports the alias behind LIGHT_HOST_PUBLISHED=true; flag remains false and domain is not assigned |

The root hostname remains on the existing infused-show Worker until INF-3. The dark canary must be noindex. The production root is indexable only when SITE_MODE=production and the request hostname is infused.show. dark.infused.show always canonicalizes to the root and remains noindex.

## Source of truth and branch boundaries

- Repository: Catalyst-Media-Partners/catalyst-website.
- Production baseline: infused-show, based on commit 891e895913b6432162b4aa27fd49df6cc918fdbe.
- Drop Journey preview source: infused-preview, which contains the separate dropjourney/ implementation.
- INF-1 candidate branch: release/infused-dark-production-inf1-20261030, created from the production baseline and populated only with the Drop Journey source subtree plus narrowly scoped production-host support. It does not merge the preview branch history wholesale.
- Existing preview Worker and config remain infused-dropjourneytest and dropjourney/wrangler.toml. They remain the preview route and are not renamed or overwritten.

## Build modes

Node 22 is required. No framework or CMS is introduced.

Preview remains the default. Run from the repository root:

    node dropjourney/build.mjs
    node dropjourney/scripts/qa.mjs
    node dropjourney/scripts/qa_native_intake.mjs
    node dropjourney/scripts/qa_ticket_notify.mjs

Production-root candidate:

    INFUSED_MODE=production node dropjourney/build.mjs
    INFUSED_MODE=production node dropjourney/scripts/qa.mjs
    INFUSED_MODE=production SITE_BASE_PATH=/ SITE_HOST=dark.infused.show INTAKE_ENVIRONMENT=preview node dropjourney/scripts/qa_native_intake.mjs
    node dropjourney/scripts/qa_dark_worker.mjs

PowerShell equivalent:

    $env:INFUSED_MODE = "production"
    node dropjourney/build.mjs
    node dropjourney/scripts/qa.mjs
    $env:SITE_BASE_PATH = "/"
    $env:SITE_HOST = "dark.infused.show"
    $env:INTAKE_ENVIRONMENT = "preview"
    node dropjourney/scripts/qa_native_intake.mjs
    node dropjourney/scripts/qa_dark_worker.mjs
    Remove-Item Env:INFUSED_MODE, Env:SITE_BASE_PATH, Env:SITE_HOST, Env:INTAKE_ENVIRONMENT

Output directories are dropjourney/dist/dropjourneytest/ for preview and dropjourney/dist/production/ for the root-path production candidate. INFUSED_MODE accepts only preview or production. Generated files are not edited manually.

## Production configuration and protected integrations

- wrangler.dark-canary.template.toml defines the new infused-dark Worker for a canary on dark.infused.show. It uses the existing preview D1 database and routes notifications through the current private InfusedIntakeSESBridge. All canary submissions remain environment=preview and route to the System Notes recipient.
- wrangler.dark-production.template.toml is intentionally not deployable yet. INF-2 must provision a separate production intake D1 database and update the private SES bridge to select the correct database for production receipts.
- The dark Worker forwards /go/booth through the BOOTH_ATTRIBUTION service binding to the existing infused-show Worker. This preserves the current Map Dynamics redirect and anonymous acquisition-click logging without duplicating the audience database.
- Native intake uses the base path, allowed host list and INTAKE_ENVIRONMENT from explicit Worker configuration. Turnstile verification checks the request hostname and the allowlist.
- Ticket notification/verification remains disabled. TICKET_NOTIFY_ENABLED=false is retained in both canary and production templates until its separate workflow is accepted.
- light.infused.show support is prepared in the existing light Worker source. It returns 404 until LIGHT_HOST_PUBLISHED=true is deliberately set and the hostname is assigned.

## INF-1 release boundary

INF-1 is source preparation and automated QA only. It does not:
- create or change DNS records or Worker custom domains;
- deploy a new Worker or change the current root Worker assignment;
- create a production D1 database or apply production intake migrations;
- read, copy, or change Turnstile/SES secrets;
- activate ticket notifications;
- change event facts, pricing, booth checkout, or Map Dynamics configuration.

INF-2 will provision the isolated canary's Turnstile secret/hostname allowlist and run real-browser canary tests. INF-3 will complete production D1/SES separation, then perform the root-domain cutover with light.infused.show assigned to the existing light Worker.

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
