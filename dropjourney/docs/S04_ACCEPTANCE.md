# DJ-S04 | Editorial homepage finish and shared dimensional water identity

2026-10-27. **Scope:** Entire INFUSED preview under `/dropjourneytest/` only. This is a design-release branch stacked on accepted DJ-S03, not a production replacement.

## User stories and implementation

| ID | As a visitor, I want… | S04 implementation | Acceptance |
| --- | --- | --- | --- |
| DJ-S04-01 | The entrance droplet's glassy dimensional shading to persist in every chapter, without jagged or low-poly edges | One reusable antialiased inline-SVG droplet template, unique gradient IDs, softly layered diffuse/specular lighting and rim shading, for intro and stage; old overlay glyph hidden | Render at 390 and 1440; gradients, volume, stroke, silhouette and focus behavior verified |
| DJ-S04-02 | The five chapters to feel designed as a coherent story, rather than a technical demo | Cleaner threshold language, concise chapter water cue, curved/feathered chapter photography, lighter connected ecosystem editorial rows, prominent chapter actions | Five chapters readable without collision and aligned with the separate detailed routes |
| DJ-S04-03 | Market metrics to adapt naturally to my screen without left-right scrolling or orphaned tiles | Three selected, individually attributed summary estimates on homepage in a balanced row or responsive stacked data rows; all five estimates and sources preserved on `/market/` | Home shows 3 selected metrics; market page retains five; 320–1440 widths without overlap or horizontal overflow |
| DJ-S04-04 | A polished, responsive site that does not sacrifice usable navigation, the water reaction, or accessibility | Retained the three-ring drag wake and single outward click ripple, Back/Forward/history, native menu/keyboard behavior, reduced-motion control via system setting and no data-submitting preview forms | S02/S03 checks remain green, S04 visual and structural QA, Cloudflare live verification, production Worker unchanged |

## Design implementation notes

- **Smooth vector rather than rendered raster or faceted polygons.** `src/drop-art.svg` supplies one continuous Bezier outline, six-stop body gradient, diffuse illumination, darker lower contour, radial specular bloom, hand-shaped glint and antialiased rim. The build expands it twice with distinct gradient IDs. No new dependencies, video, WebGL, tessellation, shader, or continuous rendering loop.
- **Heightened 3D continuity.** The same sculpture is used for the entrance and the journey, with only responsive size changes. No black decorative chapter glyph obscures the 3D shading.
- **Less interface clutter.** Prototype version labels, motion activation, repetitive full-screen explanations and large sidebar are removed/hidden. The drop cue is limited to the initial threshold; subsequent labels identify the next chapter.
- **Image finishing.** Chapter photography is gently masked into the background on desktop and restricted to the droplet zone on mobile rather than appearing as a hard rectangular card behind text. Existing original INFUSED photos and approved content are reused.
- **Full factual parity.** Homepage shows Functional Drinks $164.7B (2025 global), Dietary Supplements $209.5B (2025 global), and U.S. Cannabis Edibles $5.4B (2024 U.S.) with a short overlap qualifier. The canonical Market page retains five figures, sources and longer methodology. The chapter WHEN now links to Tickets and Exhibit options without suggesting tickets are currently for sale.
- **Detail-page continuity.** Editorial photos have consistent soft radii, headline scales and subdued tint. Deep-page content still comes from the authoritative production GitHub source at build time.

## Verification procedure

- `node dropjourney/build.mjs` from repository root with canonical `src/` available.
- `node dropjourney/scripts/qa.mjs`, `node dropjourney/scripts/qa_s03.mjs`, `node dropjourney/scripts/qa_s04.mjs`.
- Local Chromium: `python dropjourney/scripts/visual_s04.py` for 320/360/390/768/1024/1440 widths, five chapters, 3D SVG, no-overflow metrics, water hover and reduced motion.
- Original current production source GitHub CI checks remain mandatory. Local historical INFUSED folder, where present, is *not* a trusted production baseline; do not assert current production tests from it.
- Cloudflare live browser check after isolated deployment: all 16 routes, 3D drops and stage behavior, menu, mobile grid, heading order and preview `X-Robots-Tag`. Compare deployed Worker version and production `infused-show` deployment before/after.

## Protected boundary

The S04 GitHub branch and `infused-dropjourneytest` Worker are the only update targets. Production `infused-show`, zone routing, DNS, D1, checkout, Stripe, Jotform, SES, tickets and verified buyer data flows are not modified. Preview remains unlisted/noindex, **not access-controlled**.

## Next sprint

**S05: Market and Las Vegas pages.** Deepen the `Market` and `Why Vegas` subpages with source-specific evidence hierarchy, imagery and destination context while retaining every approved fact and the shared S04 aesthetic. S04 establishes the water art direction for all following pages.
