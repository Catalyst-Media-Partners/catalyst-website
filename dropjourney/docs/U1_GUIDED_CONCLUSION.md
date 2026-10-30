# DJ-U1 | Compact end-of-journey & role-specific conversion

**Entry:** U0 baseline from `docs/U0_UX_BASELINE_20261028.md`. PR #20 isolated preview; production Worker unchanged. **Objective:** visitors finishing WHY/WHO/WHEN/WHERE/WHAT can see and choose Attend, Exhibit or Buyer without searching a long commercial list or being forced to Opportunities.

## Changes
- WHAT chapter removes duplicated six-product commercial catalogue and booth price footer. That content remains on the existing authoritative Opportunities page.
- Offers exactly three visually equal role-specific routes: Attend `/tickets/`, Exhibit `/opportunities/`, Buyer `/buyers/`. No auto-role inference.
- At WHAT, final NEXT and dimensional droplet focus the first genuine role choice (keyboard-accessible), not an exhibitor redirect; WHY–WHERE Next and droplet semantics are unchanged.
- Mobile WHAT shows choices ahead of a smaller (still interactive) dimensional drop, hiding redundant sidebar routes and the extra drop hint **for WHAT only**.
- All other chapters, water physics, commerce handoff and non-submitting buyer/ticket previews remain unchanged.

## Measurable acceptance (live browser after deployment required)
1. All three role links fully in viewport at 390×844, 768×900, 1024×768, 1440×900; no horizontal overflow.
2. All three role hrefs correct and independently clickable; NEXT/drop do not automatically reach Opportunities.
3. WHAT final role interaction presents one bounded decision panel, not six duplicated commercial offer cards.
4. Earlier chapters still navigate; reduced motion/keyboard/back/hash work; no production or personal-data writes.
5. Independent QA script `scripts/qa_u1.mjs` plus unchanged S03–S10 regressions PASS.
6. Measure actual layout and deployment. If any fails, label PARTIAL, correct before U2.

**Pre-release prototype:** DOM/style browser injection without changing hosted source yielded all 3 links in viewport on four widths. This is exploratory evidence; deployed source must be retested independently.
