# DJ-U0 — Human-factors baseline & acceptance protocol

**Audit:** 2026-10-28, independent Cloudflare headless browser measurements at `https://infused.show/dropjourneytest/`.  
**Source base:** `45335d926bbb4e4d38e092e95cdd6420b1086316`, PR #20 (`dj/ux-finish-campaign-landers-20261028`).  
**Observed preview Worker:** `infused-dropjourneytest` deployment `330b1281-b9b4-4126-b403-b17f4393523b`; 100% version `e0b12cec-5403-4afa-a884-95193cab6135`.  
**Production Worker before U0:** `infused-show` deployment `c79682ae-15cf-420e-88d9-6dc7e8a6558e` (2026-10-22).  
**Version discrepancy at baseline:** live HTML advertises `2.9.0-review`, whereas source build advertises `2.9.1-review`; several legacy CI assertions and the preview Worker header still pinned `2.9.0-review`. U0 reconciles version assertions, but source-to-deployed parity still requires a successful isolated preview build and live recheck.

## Scope and evidence quality

- Browser Rendering `snapshot` with injected read-only DOM geometry instrumentation, observed at **390×844**, **768×900**, **1024×768**, and **1440×900** CSS px for WHAT and Opportunities.
- Separate live DOM snapshots at 390×844 for Hosted Buyer application and Tickets.
- A JPEG viewport screenshot was rendered successfully for each of the eight WHAT/Opportunities viewport combinations (Cloudflare rendering result). Encoded payload lengths and noncryptographic capture fingerprints below are **render receipts**, not stored or visually reviewed screenshot artifacts; preserve actual screenshot files in the future visual QA pipeline.
- GitHub source, deployment metadata and existing QA code inspected independently. No real visitor study, conversion baseline, or checkout/payment test performed. Predictions are not observations.
- No production, CRM, ticket, buyer application, or payment mutations in U0.

## Live viewport evidence — WHAT chapter

All three final role links begin *below* the initial viewport; the Next/drop mechanisms are still hard-wired to Opportunities in the source.

| CSS viewport | Document height | Final choice panel top | First role CTA top | Next button top | Horizontal overflow |
| --- | ---: | ---: | ---: | ---: | --- |
| 390×844 | 1587 | 1006 | 1132 | 1521 | No |
| 768×900 | 1375 | 848 | 974 | 1318 | No |
| 1024×768 | 1332 | 799 | 940 | 1275 | No |
| 1440×900 | 1399 | 916 | 1077 | 1342 | No |

**Defects:** UX-01 role misrouting (confirmed in `src/app.js`); UX-02 final decision below fold 4/4 viewports. Note: hidden buyer-dialog components can return 0×0 rectangles; these are **not** visible controls and must not count as in-viewport.

## Live viewport evidence — Exhibitor Opportunities

| CSS viewport | Document height | Photo top / displayed height | Initial booth CTA top | Dedicated booking CTA top | Horizontal overflow |
| --- | ---: | --- | ---: | ---: | --- |
| 390×844 | 3196 | 620 / 221 | 487 | 2079 | No |
| 768×900 | 2761 | 491 / 361 | 404 | 1666 | No |
| 1024×768 | 2342 | 212 / 447 | 605 | 1386 | No |
| 1440×900 | 2786 | 230 / 590 | 743 | 1632 | No |

**Defects:** UX-03 hero image overdominance relative to CTA; UX-04 repetitive commercial navigation. The *first* booth CTA is currently visible at all four tested viewports; do not falsely claim it is hidden. The dedicated booking CTA is well below fold. Design changes should increase task clarity, not merely optimize an above-fold boolean.

## Additional routes at 390×844

- `/buyers/apply/`: main headline top 229px; document height 2042px; 25 `input` controls in DOM and **zero native forms**. The review-stage handoff appears in the live DOM but is hidden until the relevant wizard step; it is a contact link, not submission. Do not classify as a working application.
- `/tickets/`: headline top 247px; document height 2214px; **zero native forms** and explicit notice that ticket notifications are not accepting requests. Preview cannot represent a live registration.
- Both routes: no horizontal overflow observed at 390px.
- Current event manifest: May 13–14, 2027, Las Vegas Convention Center, **operator approval pending**. Booth terms are likewise pending authoritative approval.

## Render receipts (not durable screenshots)

JPEG viewport render succeeded (8/8); each receipt is `page,width,height,encodedCharacters,quickFingerprint`:

```text
WHAT,390,844,36935,ed965d4b
WHAT,768,900,48615,15f6899f
WHAT,1024,768,54807,83d1ec9d
WHAT,1440,900,68791,8d085982
OPPORTUNITIES,390,844,43415,1c55547
OPPORTUNITIES,768,900,73307,5ea1c90e
OPPORTUNITIES,1024,768,62259,dc73625f
OPPORTUNITIES,1440,900,89835,43e9d5b1
```

Fingerprints are low-assurance sampled checksums and not suitable for screenshot-diff gates. Add preserved PNG/JPEG artifacts and image comparison to later browser QA.

## Route and conversion inventory

Generated site has **16 pages**: home; Market; Ecosystem; Roots; Science; Make; Package; Move; Sell; Services; Hosted Buyers; Why Vegas; Opportunities; Contact; Tickets; Hosted Buyer profile. Six email landing routes: default, discover, exhibit, buyers, sponsor, attend. U0 inventory script enumerates actual rendered anchors/buttons per route, checks local namespaces and records an action manifest.

| Persona | Entry and expected task | Present destination | Current result | U1/U2/U3 correction |
| --- | --- | --- | --- | --- |
| Exhibitor | WHAT → Booth options → floor plan | `/opportunities/` → `/go/booth` | Real first-party booking handoff; excessive secondary content | Compact primary action, clear cost/availability handoff |
| Hosted buyer | WHAT → sourcing fit → qualified request | `/buyers/` → `/buyers/apply/` | Local-only wizard; no submission | Role-specific route; approved secure intake in U3 |
| Attendee | WHAT → event experience → ticket/interest | `/tickets/` | Information only; notifications disabled | Role-specific route; approved capture in U3 |
| Sponsor | Sponsor path → specific packages/inquiry | `/opportunities/#sponsorship` → Contact | Reuses exhibitor page; generic route | Distinct sponsor information scent; preserve inquiry |
| First-time visitor | Ad/landing → WHY → WHAT → relevant next action | Five chapters | Final choices below fold; default transition wrong | One bounded final decision panel |

**Safety boundary:** Only /dropjourneytest/ and approved first-party /go/booth may be considered conversion destinations; no transaction in visual QA. Mark off-site contacts as external, never transmit form draft contents through URLs. Maintain noindex and isolation.

## Read-only analytics taxonomy (not yet wired)

`journey_enter`, `chapter_view`, `chapter_complete`, `final_choice_exposed`, `final_role_selected`, `detail_view`, `booth_map_handoff`, `buyer_profile_start`, `buyer_profile_review`, `buyer_inquiry_success`, `attendee_interest_success`, `sponsor_inquiry_handoff`.

Allowed dimensions: `stage` (WHY/WHO/WHEN/WHERE/WHAT), `role` (exhibitor/buyer/attendee/sponsor/undecided), `source` (approved UTM source/medium/campaign), `site_version`, `viewport_class`. No names, emails, phone numbers, free-text sourcing requests, hashed PII or contact payloads in behavioral events. Capture explicit consent requirements before enabling production analytics. **No observed user conversion rates yet; do not invent them.**

## Audience task scripts

1. **Exhibitor:** load journey, visit WHAT, identify exhibit action, reach the official floor plan without purchase; record activations, unexpected scroll/search, CTA comprehension.
2. **Buyer:** load journey, visit WHAT, identify buyer route, complete profile with synthetic data, verify truthful non-submission disclosure and available next step; do not send real data.
3. **Attendee:** load journey, visit WHAT, identify attendance path, read event details, verify nonfunctional notification state is explicit; record whether an actual next step is offered.
4. **Sponsor:** load journey, locate sponsorship content, identify contact method and back path, verify no booth booking is falsely presented as the only option.

Automated functional gates: 100% correct route targets, no overflow at four widths, keyboard/back/deep-link preservation, no external PII transmission, no unexpected production mutation. Moderated usability and real conversion outcomes require a later sample; U0 is not a usability success claim.

## U0 entry / exit

**Entry:** PR #20 source SHA pinned; known preview Worker; test-only namespace. **Exit:** evidence and task protocol committed; scripted route inventory executed by CI; source/Worker/test version assertions reconciled; preview source parity and production deployment unchanged independently verified. If CI/deployment is not verified, U0 is **PARTIAL** and cannot be labeled fully passed.

## U1 design acceptance from this baseline

- All three role CTAs can be identified and activated without page-level search after reaching WHAT; verify with actual browser geometry at 390/768/1024/1440px (including smaller-height mobile).
- NEXT/drop must not automatically navigate buyers or attendees to Exhibitor Opportunities.
- Five-chapter navigation, 3D drop, keyboard progression and back/history remain intact.
- Provide a human-visible preview and before/after viewport measurements; no unverified user uplift claims.
