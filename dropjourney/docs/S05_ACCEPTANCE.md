# DJ-S05 | Market Evidence and Las Vegas Destination

**Status:** Accepted for isolated preview deployment, 2026-10-27. Production cutover is not authorized.

**Scope:** The full 16-page INFUSED preview remains under `/dropjourneytest/`. Only the Market and Why Vegas subpage composition, shared preview date/venue source, and supporting QA/build integration are changed. Production `infused-show` is unaffected.

## User stories and acceptance

| Story | Visitor outcome | Implementation | Acceptance tests |
| --- | --- | --- | --- |
| DJ-S05-01 | As an exhibitor, I can assess five market estimates with source, forecast, year and geography visible near each figure | Market editorial hero using the three existing photos, five reusable metric articles generated **directly from production source**, a matching publisher link for each figure, one disclosed overlap note and direct exhibitor/ecosystem actions | 5/5 names, values, bases, forecasts and original URLs survive; full labels present; responsive grid without sideways scroll |
| DJ-S05-02 | As a visitor planning to attend, I can see Las Vegas positioning, published venue and useful entry points without unverified logistics | Full-frame existing destination photograph, original four positioning reasons, structured event facts with contextual Tickets, Exhibit and WHEN-chapter links | 4/4 original reasons and existing source photo preserved; no invented hotels, itinerary, consumption permissions, parking or agenda; navigation works at mobile/desktop |
| DJ-S05-03 | As a visitor, I see consistent event dates and venue across the site | `dropjourney/content/event.json` mirrors the **already published** event copy; preview build derives footer, chapter date, locale lockup, Vegas details and Opportunities date from one manifest, and fails if canonical source diverges | Dates/venue consistent on 16 pages; source-pair drift check; operator confirmation remains open prior to any production cutover |

## Source and editorial integrity

- Market numbers and forecasts are **not verified anew in this sprint**. They are carried verbatim from the current canonical production file `src/sections/market.html`, preserving the five original source URLs. The figures are not summed, and the overlapping-market explanation appears only once in the methodology disclosure.
- Market source link matching uses keys, not duplicated numeric values or hardcoded publisher dates; a missing/new metric or source makes the build fail.
- Vegas source is `src/sections/why-vegas.html`. All four original reasons, source-image alt text and lead wording are retained. Date/venue/city are copied from the currently published production site into a single structured preview manifest.
- **Unresolved:** Signed/official date and venue authorization was not independently inspected; existing published May 13–14, 2027 at Las Vegas Convention Center is kept unchanged in the preview, without claiming new confirmation. Needs operator approval before production replacement.
- No unsupported hotel recommendations, travel packages, participation perks, venue operations, agenda, licensing or consumption claims were added.

## Performance, accessibility and visual QA

- Dependency-free source-to-HTML transformations; three original Market images and the existing Vegas image, not unapproved stock.
- HTML hierarchy: one H1 on each page; additional original H3 reason headings and accessible `dl` event facts; keyboard-openable `details` for methodology; meaningful alt text preserved.
- Reflow: Market figure grid uses 3+2 editorial pattern at large widths, two columns on tablet and one column on narrow mobile; Vegas reasons and venue facts stack at mobile; no carousels or horizontal scrollbars.
- All prior S02–S04 UX features protected: responsive navigation, history, dimensional 3D droplet, drag water, single click ripple, reduced motion, inert buyer/ticket forms, unchanged booth attribution.
- Run original production build / ticket tests before deploying the new isolated Worker. Run `dropjourney/scripts/qa_s05.mjs` and verify published HTML/HTTP and visual behavior at 1440, 1024, 768, 390 (and 320 where feasible).

## Version control and deployment

- **GitHub branch:** `dj/s05-market-vegas-evidence-20261027`, based on S04 (`db94ac41fd583124ea804b5871ba7984d480ee27`); draft stacked PR only, never merge into production without explicit approval.
- **Cloudflare:** the existing route `infused.show/dropjourneytest*`, Worker `infused-dropjourneytest` and its isolated ASSETS binding only. Preview content stays `noindex,nofollow,noarchive` in HTTP and HTML. Production `infused-show`, DNS, D1, commerce, ticketing, email, Stripe and secrets are protected.
- **Release receipt:** Populate GitHub commit, successful CI link, preview deployment ID, production deployment integrity and live browser QA after release acceptance.

## Next sprint

**DJ-S06: Ecosystem hub and upstream supply chain.** Make the value-stream navigation and Roots, Science, Make and Package pages feel like one interactive ecosystem, keeping the S04 water identity, S05 evidence presentation, and existing source/commerce boundaries.

## S05 acceptance receipt

- **Source branch:** `dj/s05-market-vegas-evidence-20261027`. Draft PR: https://github.com/Catalyst-Media-Partners/catalyst-website/pull/18, stacked on S04, not on the production branch.
- **Successful release run:** https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/40613043608. Verified actual CI log statements `PASS DJ-S03`, `PASS DJ-S04`, `PASS DJ-S05`, 16 preview pages, existing production build/integration tests and successful isolated Wrangler deploy. S05 source code commit in that run: `53bbcf3d60d2178c4b0854f2d99c8fb76cf17035`.
- **Live pages:** https://infused.show/dropjourneytest/market/ and https://infused.show/dropjourneytest/why-vegas/, version `2.3.0-s05`, 200 status.
- **Responsive audit:** 12 browser cases across 320, 360, 390, 768, 1024 and 1440px for both pages. All had zero document horizontal overflow; the Market source/metric layout had zero internal scroll, collisions and offscreen cards; Vegas reasons stacked at mobile without CTA/photo-caption collisions. Desktop/mobile screenshots visually inspected.
- **Content:** 5/5 canonical figure names, amounts, years, geography, projections, and original publisher URLs preserved and visible. Four/four original Vegas reasons and canonical photo retained. The market overlap note appears once in the methodology disclosure.
- **Whole preview:** 16/16 routes loaded at 390px with `2.3.0-s05`, one H1, noindex, no native forms, no horizontal document overflow, and no loaded broken images.
- **Functionality:** Market links to Opportunities/Ecosystem work; Vegas links to Tickets/Opportunities and `#when` are correctly namespaced. The homepage `#when` direct link displays the published date/venue; Opportunities shows the same. Detail-page three-ring water hover/click rendered with no JavaScript errors on both S05 pages. Existing S03/S04 interaction tests passed in CI.
- **Cloudflare deployment:** Preview Worker `infused-dropjourneytest` deployment `a99be7df-5d97-412a-a3b9-f5025437e73b`, Worker version `ff4a5b26-70f8-4bc8-bd72-18b84081021f` (initial accepted code deployment, 2026-10-28 UTC). Binding: `ASSETS` only. **Production Worker `infused-show` remains at deployment `c79682ae-15cf-420e-88d9-6dc7e8a6558e`.** This acceptance-document-only commit may rerun the test deployment with identical program behavior.
- **Outstanding factual approval:** Independently verify the signed or officially authorized INFUSED May 13–14, 2027 date and Las Vegas Convention Center before any full production replacement. This sprint preserved current published facts, and introduced no new operational promises.

**Next DJ-S06:** Ecosystem, Roots, Science, Make, Package. Maintain the S04 water visuals, existing source data/links and S05 evidence-first editorial style.
