# INFUSED official identity — brand source and website audit
Audit: 2026-10-28. Reviewed **all 16 website routes and 6 campaign landing routes** of the isolated INFUSED Drop Journey preview. Compared artwork to two Illustrator-generated master PDFs from connected company Drive accounts.

## Authoritative source references
- **INFUSED LOGOS MASTERS.pdf**, created in Adobe Illustrator 29.8, 5 pages, CannaCon Drive: https://drive.google.com/file/d/1vGdOitn3BuDy7g78kMjYWDzFfiNzVQUQ/view (PDF SHA-256: `12009eb959c1e155fe8ef5c1593024138873ca3fa795e5caf2db408953c96431`). Variants: dark wordmark on white, white wordmark on dark, green droplet icon treatments.
- **INFUSED LOGOS.pdf**, created in Adobe Illustrator 29.8, 3 pages, Catalyst Drive: https://drive.google.com/file/d/1xHMwkVRm-fC5GqWZ1JWoFmKOhJT9L4bd/view (PDF SHA-256: `91f07a3948812ef628c503be4cc58aa7c9f9a7b164337d58f7a840dc9e272488`). White, black and dark-green treatments.
- **Infused_Icon_NoWords.png**, Catalyst Drive "Image and Logo Assets": https://drive.google.com/file/d/1XUsjFhIpBbSxeFYe2_hY5ixXpqW-hoFD/view (PNG SHA-256: `e646a55845f0692e0559f0080775330f5cc06ffea0f82fe978f950ff7e6f7287`). Droplet-only artwork; possible favicon source, not used as a wordmark.

## Observed website logo use
- Pages inspected: home, market, ecosystem, roots, science, make, package, move, sell, services, buyers, why-vegas, opportunities, contact, tickets and buyers/apply. Header and footer logos use the same embedded white+green wordmark.
- Campaign landers inspected: default, discover, exhibit, buyers, sponsor, attend. All use the same wordmark.
- Every tested logo instance is the same PNG (natural dimensions **500 × 113**). Browser-derived SHA-256: `6e34f242567f4af804ea57fb096ac9fa141d22c6a15e54123b2c68f65c319ed6`. Homepage hero and inner-page header/footer all match. No competing alternate branding surfaced in inspected logo elements.
- Visual comparison against Illustrator master pages confirms the same **INFUSED wordmark and integrated green droplet** in the approved white-on-dark treatment. **Not a byte-for-byte master export comparison:** master PDFs are vector artwork with multiple treatments, while the preview uses a raster PNG inherited from its original homepage source.
- Existing **production site** `https://infused.show/` uses `assets/images/infused-logo-00.webp`, a dark-green lockup incorporating the words "Las Vegas Exhibitor Invitation" (535 × 146), appropriate to that original sales page but **not** the white wordmark for this dark-background preview. Do not blindly substitute it.
- No site-specific favicon `link[rel=icon]` was observed on the 22 preview routes. This is a separate low-priority branding enhancement; use a verified official droplet-only asset with its own QA rather than redrawing the mark.

## Implementation control
`scripts/qa_brand_logo.mjs` checks every generated site page and landing route, pinning the PNG SHA-256 and rejecting unexpected replacement or silent production invitation-logo fallback. An earlier source parser could silently fall back to `infused-logo-00.webp` if the inlined master-look wordmark disappeared; the build now fails closed instead.

## Acceptance and limitations
**PASS for identical use and visual artwork consistency across all 22 routes.** Retain visual wordmark unchanged. **Conditional** for immutable source provenance: the PNG was embedded in an earlier approved prototype, rather than regenerated directly from the illustrator PDF. Do not claim cryptographic equivalence to the PDF. If a future official master export is supplied, compare it and update the pin only after approval. No logos altered in this sprint. Jotform externally hosted forms are outside the 22 preview routes and require separate provider theme/branding review.

## 2026-10-28 final high-definition source correction

User supplied both original INFUSED Illustrator/PDF master files and four PNG lockups. Original hero used a `500×113` embedded raster magnified at the page threshold; its text edges and droplet were visibly soft. Reviewed the supplied white wordmark/dark-green-shaded-droplet treatment, especially `INFUSED-LOGO-ON-BLACK-DIM.png` and its original transparent wordmark mask `INFUSED-LOGO-REVERSE.png`.

Approved high-definition web asset: `src/assets/images/infused-wordmark-shaded-web-hd.png`, **1588×358 RGBA, 38,858 bytes**, SHA-256 `bd29ef66ed28f94005043e6e4dae0f3ba48781ac5413f038d9dba9d8df12e7ff`. Export process: preserve the original ON-BLACK-DIM RGB appearance, apply the exact alpha silhouette from the provided same-size official REVERSE file, and crop **transparent padding only**. No typography, green gradient, or droplet geometry was redrawn. Source originals SHA-256: ON-BLACK-DIM `3ba362cd9541d7d049e18aecf6b8e2de207829746aa7dba02f9dadc19cd401c6`, REVERSE `533fd35f479a1278a0cff5c30fdad69a697e543f28fdcd24f51b18514b96e77a`. Archived company version: Catalyst Drive `Catalyst Media Partners/Infused/Logos/INFUSED-WORDMARK-SHADED-WEB-HD.png`.

The home threshold and header, all 16 site pages, and six campaign landers use this **same high-definition official artwork**. The main site uses a cached independent PNG file; portable campaign exports retain the same exact PNG inlined for independent hosting. Build and `scripts/qa_brand_logo.mjs` fail closed on hash or route discrepancy. This supersedes the earlier 500×113 provenance pin above; the earlier audit remains historical evidence, not the active target.

**Acceptance requirements:** fresh browser image dimensions are 1588×358 and render without stretching at 390/768/1024/1440; no intro CTA displacement; header navigation and five chapters still pass; all official assets must be from user-provided originals; no unintended production Worker change during preview QA.
