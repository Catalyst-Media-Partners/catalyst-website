# DJ-U2 | Exhibitor decision-page redesign

**Entry:** DJ-U0 measured baseline and DJ-U1 PASS preview. PR #20 source branch; isolated preview only. **Objective:** remove the trade-show photo and secondary-offer catalogue as obstacles to exhibitor commerce.

## Implemented design
1. Approved photo retained, capped at **310px desktop**, **230px tablet** and **170px mobile** with horizontal/editorial crop. Commercial headline size and spacing tightened.
2. Hero offers direct official booth availability and a separate sponsorship anchor. Source pricing and the existing purchase handoff are unchanged.
3. Booking terms moved immediately after hero, so price/availability context no longer sits after six long product cards.
4. Sponsor receives a visible, linkable `#sponsorship` section and approved contact action. Five other source-derived options remain inside native `details/summary` progressive disclosure.
5. Removed the generic repeating YOUR NEXT MOVE panel from Opportunities only. Other page endings retain their existing next actions.

## Acceptance
- **Before:** at 1440×900 photo 590px high, document 2786px, first booth CTA top 743px, booking CTA top 1632px; at 390×844 photo 221px, document 3196px, first CTA top 487px, booking CTA 2079px.
- **Targets:** photo ≤310px desktop / ≤170px mobile; initial purchase CTA within all tested first viewports; booking action substantially earlier (desktop at or above 900px, mobile at or above 1250px); route length ↓ ≥25% at 390 and 1440 without deleting any of six commercial descriptions; no horizontal overflow.
- All six original commercial paths in DOM; five in user-activated native `details`, direct visible sponsor anchor. Source links/prices preserved; no live checkout initiated.
- Browser navigation to `/opportunities/#sponsorship` must show sponsorship without manually opening hidden disclosures.
- `qa_u2.mjs` plus S03–S10, U0 and U1 regressions pass. **Do not mark PASS until deployed viewport and anchor checks.**

**Browser-only DOM/style prototype before commit:** 390×844 page document height 1895px, photo 170px, first booth CTA top 476px, booking action top 1101px. 1440×900 doc 1561px, photo 293px, first CTA 620px, booking action 793px. These are design predictions, not deployed acceptance evidence.
