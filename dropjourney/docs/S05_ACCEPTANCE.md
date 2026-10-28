# DJ-S05 | Market Evidence and Las Vegas Destination

**Status:** Implementation and validation in progress. 2026-10-27.

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
