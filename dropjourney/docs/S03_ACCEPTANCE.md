# DJ-S03 | Navigation, water motion and responsive data layout

**2026-10-27.** Full INFUSED preview remains entirely under `/dropjourneytest/`. This is an incremental change on the S02 16-page preview, not a production rebuild.

## Story outcomes

| Story | User outcome | Implemented / evidence |
| --- | --- | --- |
| DJ-S03-01 | High-intent visitors reach Exhibit, Attend/Tickets, Buyers, Sponsor or Contact directly | Five actions in the responsive Explore menu on every detail route and the homepage; Sponsor links to real `#sponsorship` content within the preview Opportunities page; existing booth CTA retains approved `/go/booth` handoff. |
| DJ-S03-02 | Keyboard/touch/mouse menu works at all widths | Explore focuses first link, Escape closes and returns focus, outside click/focus exit closes, all targets are at least 44px where practical; static and browser checks at 320–1440px. |
| DJ-S03-03 | Shareable chapter links and native Back/Forward | Home transitions create `history.pushState` entries preserving UTM query params; `popstate` and `hashchange` restore stages; detail wayfinder links back to contextual home chapter (e.g. `/#who`); no-JS navigable alternate menu. |
| DJ-S03-04 | No preview route escapes into old site | 16 distinct pages, same namespaced assets, Jotform only on original Contact route, `/go/booth` production handoff explicitly allowed; Worker rejects unrelated paths and preview APIs; test remains noindex and does not write PII. |

## User-reported regressions addressed within S03

- Water follow and click are visibly restored on **homepage and subpages**. Detail pages use three coupled, drag-inertial Canvas 2D water menisci; click produces one damped expanding ring. The original drop retains its subtle 470ms rebound on interaction. Homepage's original v1.5 physics was retained and strengthened for contrast, without a heavy shader or perpetual animation loop.
- No activation button appears. Respect `prefers-reduced-motion`; people who have reduced motion enabled will see a functional nonanimated journey.
- Horizontal metrics scroller `market-scroll` is replaced with an auto-fitting CSS grid. The five-way chapter selector is a responsive grid and **never requires sideways scrolling**. Detail-page stats, source image ribbon, ecosystem rows, and opportunities grids reconfigure without collisions. The source's factual figures and warnings are unchanged.
- Optional `@view-transition` produces a very short, reduced-motion-aware cross-page change where the browser supports it; otherwise ordinary native navigation works.

## Verification

- `npm run build`, `npm run check`, `node scripts/qa_s03.mjs`, `node --check` on modified JS.
- `python scripts/visual_qa.py`: representative 16-page image/interaction checks.
- `python scripts/qa_s03_smoke.py`: **60 checks** across 320, 360, 390, 768, 1024, 1440px and 16 routes; no clipping, horizontal scrollable metric/card containers or overlapping tiles; canvas pixel tests and no-JS fallback tests passed. No personal data was used in buyer wizard tests.
- **Live Cloudflare browser acceptance:** All 16/16 URLs loaded at 390px with `2.1.0-s03`, exactly one H1, no forms, no horizontal overflow and `noindex` metadata. The twelve tested homepage and Market page layouts at 320, 360, 390, 768, 1024 and 1440px showed zero metric/selector overflow, collisions or offscreen cards.
- **History:** `#why → #who → #when → Back → Back → Forward` returned the expected stages with `utm_source` intact and no duplicate history entries. Detail pages link to their relevant chapter; sponsor anchor exists on Opportunities.
- **Water:** Live Canvas rendered three-ring hover and click ripple on both homepage and Market detail; the homepage droplet rebound was active. A frame-timing defect that could generate a non-finite click radius on detail pages was fixed and protected by static + browser pageerror smoke checks.
- **Safety:** HTTP `X-Robots-Tag` verified noindex on previews and 404s; unknown/suffix/API routes fail closed. Cloudflare confirms distinct preview Worker and unchanged production Worker, with only `ASSETS` bound to the preview. Final deployment IDs and the GitHub Actions run are tracked in the sprint PR acceptance receipt.

## Protected scope

Only GitHub branch `dj/s03-navigation-motion-responsive-20261027` and Cloudflare **test** Worker `infused-dropjourneytest` can change. No changes to production `infused-show`, DNS, D1, Map Dynamics/Stripe, ticket email setup, Jotform, sales, or secrets. Preview is publicly reachable by URL but excluded from indexing, **not authenticated private**.

## Next S04

S04 completes the five-chapter homepage as a polished front door: simplified threshold, purpose-built chapter imagery and copy hierarchy, one primary CTA per stage, and tuned water interactions. S03 has already supplied working navigation, routing and responsive grids so S04 can focus on the editorial journey rather than infrastructure.
