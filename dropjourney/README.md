# INFUSED Drop Journey | S02 multipage test site

**Preview only:** `https://infused.show/dropjourneytest/`

S02 establishes a coherent design and interaction system for a *complete second INFUSED site* in the public but unlisted `/dropjourneytest/` namespace. It does not change the published INFUSED homepage or its protected services.

## Source of truth
- **GitHub:** `Catalyst-Media-Partners/catalyst-website`. Production `infused-show` branch and exact Oct 22 baseline `891e895913b6432162b4aa27fd49df6cc918fdbe` remain unchanged.
- **GitHub development:** `dj/s02-dropjourney-site-20261027`, stacked on `dj/s01-trusted-baseline-20261027` until accepted. Every S02 editable source file, test and workflow lives here.
- **Cloudflare:** independent Worker `infused-dropjourneytest`, existing zone route `infused.show/dropjourneytest*` only. The existing `infused-show` Worker continues to serve `/` and all production services.
- **No Google Drive** or secondary release archives are part of version control or sprint acceptance.

## What is built
The journey homepage (Why, Who, When, Where, What); matching editorial styles on the 14 production subpage equivalents; a six-step buyer profile preview at `/dropjourneytest/buyers/apply/`. **16 HTML pages** total, **21 approved-source media files**, shared header/footer/menu, preserved market sources, original copy and contact conversion actions, and light native-Canvas water interactions. Routes include Market, Ecosystem, Roots, Science, Make, Package, Move, Sell, Services, Buyers, Why Vegas, Opportunities, Contact, and Tickets.

## Commands
No framework. Node 22 required; no install necessary for build and structural checks.
```
node dropjourney/build.mjs
node dropjourney/scripts/qa.mjs
```
Generated assets: `dropjourney/dist/dropjourneytest/`. Do not edit generated files. Local Python/Chromium visual checks are separate; `scripts/visual_qa.py` is QA tooling only, not a build dependency.

## Environment and protected flows
The original `src/sections/` and `src/assets/images/` are read at build time, so this preview is regenerated from the current production-source branch rather than duplicating facts in hand-authored HTML. The homepage preserves the editable v1.5 source interaction with 3 coupled water rings; `src/home.css` removes prototype-only interface clutter.

- All navigational links, logo and chapter destinations resolve beneath `/dropjourneytest/`.
- The official `/go/booth` production endpoint remains the commerce exit where used. No checkout or D1/Stripe code is copied into the preview Worker.
- Buyer information is **not transmitted or stored**. The guided profile is a client-only preview using a `div`, not a native form, and can copy a locally assembled draft upon explicit click.
- Preview ticket interest does not accept submissions. Live ticket verification/unsubscribe APIs remain on the existing production Worker and are not exposed or cloned under the preview path.
- All preview HTML is `noindex, nofollow, noarchive` in metadata **and** by Worker headers. Do not list it in production sitemap. Anyone knowing the URL can view the preview; **noindex is not access control**. A separately authorized Cloudflare Access policy would be required for genuine restricted access.
- A dedicated GitHub workflow runs source QA and deploys **only** `infused-dropjourneytest` from this specific development branch, preserving the current production Worker deployment ID.

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
