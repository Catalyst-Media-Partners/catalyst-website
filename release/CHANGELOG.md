# v1b.3 - INFUSED-specific contact form (2026-10-14)

- Replaced the CannaCon exhibitor-request destination in the shared INFUSED contact CTA with the new INFUSED Jotform.
- Updated only the CTA label to “Contact the INFUSED Team”; existing surrounding copy, images, layout, primary navigation, floor-map link and 14 routes remain unchanged.
- Form: https://form.jotform.com/262867873887079. Notification delivery and live submissions require form-owner verification.
- No registrar DNS, Cloudflare domain switch, Catalyst Worker or CannaCon form changes.

# v1b.2 - Verified legacy URL handoff (2026-10-14)

- Added seven permanent redirects for verified pre-migration WordPress entry routes; no public copy, imagery, 14 approved pages or existing destination paths changed.
- Preserved query strings through those redirects, including campaign attribution parameters.
- Added redirect checks without changing the existing Workers.dev noindex, production canonicals, sitemap, www redirect or Cloudflare bindings.
- Updated domain-cutover documentation from verified registrar DNS and live deployment state.
- Outstanding before complete legacy retirement: review the old WordPress-specific privacy policy, recover or replace the linked hosted-buyer PDF, and verify legacy forms / marketing inbound links not listed in the site navigation.

---

# v1b.1 - Source-only quality and aesthetic release (2026-10-13)

- Removed the solid black artifact below the navigation logo by cropping the presentation-derived WebP source asset (without changing the logotype/subtitle).
- Reflowed the existing six mobile navigation links into a fully visible, two-row menu; labels, links and desktop hierarchy remain untouched.
- Darkened saturated accent-colored **text only** for WCAG AA legibility. Brand accent stripes, borders and card structure unchanged.
- Added intrinsic image dimensions, decoding hints, lazy-loading where appropriate and hero priority; existing imagery, alt descriptions and order unchanged.
- Fixed the domain Worker's canonical URL for /index.html aliases; no visible-content change.
- Removed dead bootstrap code, and removed self-committing CI steps. Existing authorized-actor gate, standalone Worker and Cloudflare account are preserved.
- Added very-narrow viewport reflow for unusually high zoom levels (256px CSS viewport).
- Removed generated `public/` from the **source ZIP**. `npm run build` recreates it locally or during deployment.
- No public text, page order, conversion links, event facts, or section hierarchy changed. See `release/V1B1_AUDIT_CHANGELOG.md`.

---

# v1b.0 - New independent development baseline

- New **full baseline**, with **no required predecessor** and no imported earlier v1.x source.
- Original `INFUSED_Las_Vegas_Exhibitor_Invitation.html` retained unmodified in source reference.
- Original homepage structure (12 sections), all visible text, CSS appearance and 21 images preserved.
- 21 embedded WebP images extracted byte-for-byte into reusable `src/assets/images` resources.
- Existing menu destinations and value-stream tiles now open 13 independent subpages instead of scrolling to homepage anchors.
- Subpage content comes exclusively from original sections/cards; no new marketing claims or copy.
- Relative page and image paths resolve with Live Server serving either `public` as root or the project root.
- Original CSS reused, with narrowly scoped reflow adjustments for small screens and page-level H1 semantics.
- Added dependency-free `build.mjs`, structural checker, source references and generated `public/`.
- Development preview protected by `noindex, nofollow, noarchive` and `robots.txt` Disallow.
- External CannaCon exhibitor-request and Map Dynamics links are retained exactly as supplied.
