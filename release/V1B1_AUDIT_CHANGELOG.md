# INFUSED v1b.1 | Non-editorial quality and aesthetic audit

Scope: preserve every displayed word, all 12 home-page sections and 13 subpage routes, existing CTAs, and existing external destinations. Keep the independent v1b.0 architecture. The original invitation HTML remains unchanged as a reference.

## Confirmed defects and approved fixes

1. **Black band below navigation logo (asset defect).** The bottom 21 pixels of `src/assets/images/infused-logo-00.webp` (540 x 167) contain a black screenshot/embedding artifact, starting near row 146. Crop that artifact and a five-pixel left border without altering the actual logotype or purple subtitle. Update source asset and its SHA-256 inventory; do not use CSS to hide pixels.
2. **Mobile navigation obscures important destinations (discoverability).** At 390px, the 6-link navigation overflows its horizontal scroller by 373px. The Exhibit Options and Get Involved actions are off-screen without any clear scrolling cue. Reflow the same six links into a visible grid below 780px rather than leaving conversions hidden behind a horizontal scroll. Preserve every label, destination, and desktop navigation treatment.
3. **Low-contrast colored figures and card labels (accessibility).** Several category headings and market figures use saturated light cyan, green, orange, yellow, and pink on white, with approximate contrast between 2.2 and 4.2:1. Use a darker tonal version of each existing accent for text only, retaining original accent stripes/borders. Provide a standard-color fallback for browsers without `color-mix()`.
4. **Image layout/loading detail (performance).** HTML images lack explicit intrinsic width/height and async decode hints. Add intrinsic dimensions and decoding attributes to the existing tags, keeping all existing image content, order, alt text, visual crops, link hierarchy and dimensions unchanged. Defer only offscreen thumbnails where useful. Prioritize hero imagery. No client-side library.
5. **Incorrect canonical for `index.html` aliases (technical SEO).** The domain Worker generated `/index.html/` as the canonical path for `/index.html`, and similarly for subpages. Normalize the generated canonical path to `/` or the containing section path with an additional Worker regression test. No public-facing text or layout changes.
6. **Obsolete one-time bootstrap and self-committing CI (release safety).** The source branch already contains real files. Remove unused `bootstrap.mjs` and the now-dead archive unpack/self-commit steps from the deployed workflow. Limit workflow permissions to `contents: read`, retaining the existing authorized-actor deployment guard.
7. **Release packaging redundancy (build discipline).** Full archives duplicated every source image and generated `public/` image. Remove `public/` from the next source ZIP and document `npm run build` for Live Server and Cloudflare Workers. Preserve static generator and clean release-root mapping, never commit generated output.
8. **Regression-proof release process.** Add source-text and layout QA evidence to the release record, update the asset inventory and reproduce the build from a clean extracted source ZIP. Add no new public-facing copy or sections.

## Explicitly out of scope

- Any changes to event dates, market forecasts, CannaCon handoff, ticket or floor-plan destinations, or legal copy.
- Restyling or restructuring the approved original sales invitation beyond the small corrections above.
- Domain registrar, DNS, SSL, production routing, protected commerce, or unrelated Catalyst/CannaCon source.

## Release acceptance criteria

- All 14 routes resolve; homepage visible text and all subpage text remain exactly identical to v1b.0.
- Navigation labels and destinations unchanged; all six primary destinations visible at 390 and 320 CSS-pixel viewport widths.
- No document-level horizontal overflow or missing images at 1440/1024/768/390/320px.
- No black pixels spanning the lower logo strip; descriptive alt text preserved.
- Core colored figure/category text meets WCAG AA 4.5:1 contrast target against white.
- `npm run build`, `npm run check`, and `node scripts/verify-cloudflare.mjs` pass.
- Clean ZIP extracts to `infused_site/` with NO `public/`, no node_modules or secrets, then regenerates the entire `public/` directory.

