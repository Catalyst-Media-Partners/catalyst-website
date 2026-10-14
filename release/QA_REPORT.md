# v1b.1 QA | No-editorial quality refresh

**Source:** independent approved Infused v1b.0, with 14 routes. This release is source-only and does not change public copy, navigation targets or section order.

## Passed

- Source content comparison against approved v1b.0, 14 HTML pages: normalized rendered body text exact match; anchor URLs exact match; alt text exact match; DOM tag order exact match; one H1 per page.
- Original embedded HTML reference unchanged, SHA-256 `d7ae64fd71b3c23f0c9f298fa6d29111ddc895693830d4fad7651d4196fd61bb`.
- Logo image cropped from 540 × 167 to 535 × 146 pixels; solid black lower strip removed. Purple subtitle and Infused logotype retained.
- Accented category heading and market-number text contrast check: all assessed text colors at least 5.52:1 against white using the specified `color-mix` rule; brand accents preserved in borders and bars.
- Source-generated HTML renders in in-memory Chromium at 1440, 1024, 768, 390, 320 and 256 CSS pixels across all 14 pages (84 combinations), with no document-level horizontal overflow, broken images, or JavaScript errors. All six navigation links appear in the viewport; no hidden horizontal mobile menu scroll.
- 14 HTTP 200 route responses from locally started static server, plus CSS and logo asset HTTP 200. Chromium direct local-navigation URL access is restricted by the execution environment, so its route QA used in-memory rendering and Python HTTP separately.
- `npm run build`, `npm run check`, `node scripts/verify-cloudflare.mjs` pass, including canonical URLs, preview noindex, sitemap and WWW redirect checks.
- Intrinsic width/height and alt text present for all HTML images, and WebP asset inventory digests match source.
- Source-only ZIP extraction into clean parent directory, `npm run build`, and byte-for-byte comparison of all generated `public/` files pass. No `public/`, `node_modules`, `.env` or `.dev.vars` in the archive.

## Not claimed

- Independent complete WCAG 2.2 AA audit, Safari/WebKit or Firefox rendering, comprehensive external-link verification, market-claim fact checking, image licensing audit, real paid checkout, end-to-end registration, and public Workers.dev browser QA are outside this cosmetic update.
- The external exhibitor request still leads to CannaCon and the floor map still leads to Map Dynamics, exactly as in the user-approved source.
- The domain and DNS cutover are not part of this release. No changes to Catalyst/CannaCon DNS or Workers.

## Visual evidence

The QA runner generated local screenshots at 1440, 390, and 320 (home), 1440 and 390 (ecosystem) and 390 (market). These are kept as development QA, not published as website assets.
