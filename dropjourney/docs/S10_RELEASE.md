# INFUSED Drop Journey | DJ-S06 through DJ-S10 | Integrated preview acceptance

Date: 2026-10-27
Release: 2.8.0-s10
Scope: Full 16-route INFUSED alternate website at `https://infused.show/dropjourneytest/`

**NO PRODUCTION CUTOVER.** This is an isolated review release. The production `infused.show/` site and Worker `infused-show` must remain unchanged until a distinct explicit authorization. No DNS, secrets, production D1 data/schema, webhooks, Stripe, protected `/sales`, production tickets, or transactional forms are modified.

## User-story acceptance register

| Sprint | Story IDs | What the visitor receives | Gate |
|---|---|---|---|
| DJ-S06 | 06-01, 06-02, 06-03, 06-04 | 7-stage visual ecosystem with hosted buyer crossover; Roots, Science, Make and Package detail; canonical taxonomy and crosslinks | Structural QA S06 and live ecosystem routes |
| DJ-S07 | 07-01, 07-02, 07-03, 07-04 | Move, Sell and Services detail pages, all 7 categories connected via previous/next, responsive and accessible | Structural QA S07 and all 7 routes |
| DJ-S08 | 08-01, 08-02, 08-03, 08-04, 08-05 | Two-audience Hosted Buyers page and 6-stage guided *non-submitting* buyer profile with errors, review and manual draft copy | Structural QA S08, keyboard/touch review |
| DJ-S09 | 09-01, 09-02, 09-03, 09-04, 09-05 | Six existing exhibit/sponsor paths, preserved first-party booth attribution, approved Jotform, truthful inactive ticket state | Structural QA S09 and handoff checks |
| DJ-S10 | 10-01, 10-02, 10-03, 10-04, 10-05 | 16-page self-consistent preview, accessible navigation, dimensional drop, 3-ring water, mobile reflow, CI and rollback receipt | CI S02-S10 + independent browser + Worker isolation |

## Content and integration principles

- **Authoritative code:** GitHub `Catalyst-Media-Partners/catalyst-website` on dedicated `dj/s06-s10-complete-preview-20261027` branch, based on accepted S05 source. Production code remains on the existing `infused-show` branch.
- **Authoritative deployments:** Cloudflare production Worker `infused-show` and isolated test Worker `infused-dropjourneytest`. The test Worker only has a static `ASSETS` binding.
- **Page generation:** `dropjourney/build.mjs` uses canonical production `src/sections/*`, `src/tickets/index.html`, 21 source images, and structured `content/taxonomy.json` and `content/event.json`. Existing facts, names, category descriptions, original market statistics, photo assets and program terminology remain sourced, not invented.
- **Pages:** `/dropjourneytest/`, `/market/`, `/ecosystem/`, `/roots/`, `/science/`, `/make/`, `/package/`, `/move/`, `/sell/`, `/services/`, `/buyers/`, `/why-vegas/`, `/opportunities/`, `/contact/`, `/tickets/`, `/buyers/apply/` (all nested under the prefix).
- **Motion:** retain S04 smooth 3D gradient droplet and S03 mouse-follow 3-ring water, single click ripple, keyboard navigation, prefers-reduced-motion support and mobile layout without horizontal scrolling.
- **Preview contact:** The existing original production Jotform is the only active inquiry destination; it is an explicitly approved external handoff. Preview does not collect requests directly.
- **Booth handoff:** Existing first-party `https://infused.show/go/booth` anonymous attribution route is preserved. Pricing is reused verbatim from the existing published canonical source and the official interactive floor map controls final availability and cost.
- **Buyer wizard:** Six existing prompts with no native `<form>`, no network POST, no local persistence. Only deliberate browser clipboard copy on user click. No automatic buyer enrollment, eligibility or VIP commitments.
- **Tickets:** The canonical published offer is presented as *not activated*; ticket sales and notifications are not enabled by the preview, with no subscription forms, verification sends or ticket API writes.
- **Noindex:** HTTP `X-Robots-Tag: noindex, nofollow, noarchive` and `<meta name="robots">` on all HTML; no preview sitemap; unknown preview routes return 404. Preview is **unlisted, not access-controlled**. Anyone with the URL can view it.

## Acceptance and rollback

- Automated: baseline production build/structure/W02 regression, S02/S03/S04/S05, S06/S07/S08/S09/S10, Worker safety and 16-route asset checks.
- Browser: live page/asset/error status, mobile 390, tablet 768, desktop 1024 and 1440, plus narrow 320/360 where possible; no overflow, no colliding CTAs, no broken images, keyboard menu/focus, active chapter/history, buyer guided flow, reduced motion, safe outbound links, visible hover/ripple.
- Rollback: identify last accepted test Worker version/deployment ID in Cloudflare; roll back **only** `infused-dropjourneytest` via the Cloudflare Worker deployment control or redeploy the preceding accepted GitHub preview commit. Never alter `infused-show` to reverse a preview release.
- Signed date/venue evidence, checkout current inventory/pricing approval and ticket/buyer activation remain outside this sprint's publishing authority; no production cutover is authorized.

## Evidence receipt

Fill upon final CI, Cloudflare browser and integrity verification. Pending evidence does not count as a pass.