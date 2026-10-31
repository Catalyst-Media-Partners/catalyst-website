# INFUSED Las Vegas, v1b.1 audited source baseline

This is an entirely new starting point built **only** from `src/reference/INFUSED_Las_Vegas_Exhibitor_Invitation.html`. No assets, JavaScript, page copy, content data, CSS or site architecture from v1.0-v1.4.1 is imported. The source invitation is included untouched for reference.

## Run in VS Code + Live Server

1. Extract this archive into a folder containing `infused_site/`.
2. Open the `infused_site` folder in VS Code.
3. Run `npm run build` (Node 18+; there is **no npm install**).
4. Open `public/index.html` with the Live Server extension, or configure Live Server's root as `public/` and open `index.html`.
5. Run `npm run check` after making changes. For local viewing, use **Live Server**, not production DNS.

The **ZIP is source-only** and intentionally excludes `public/`, the generated static output. Run `npm run build` on every fresh extraction, and after source edits. The same build runs in Cloudflare GitHub Actions. Do not upload project source to a static web root; deploy only the generated `public/` contents.

All internal page and image paths are **relative**. Links work whether Live Server serves `public` or serves the project folder with `/public/` in the URL.

## Source structure

- `src/reference/`: byte-original invitation HTML and source image SHA-256 inventory.
- `src/components/before.html`, `after.html`: shared header, navigation and footer from the invitation; `{{BASE}}` placeholder resolves asset and page links.
- `src/sections/*.html`: the twelve original homepage sections, with original **copy unchanged** and links redirected to subpages. Two extra focused pages, MAKE and MOVE, reuse words from their original card/parent section.
- `src/assets/images/`: the 21 presentation-derived WebP images, retaining all original alt text. In v1b.1 the logo image is narrowly cropped to remove a black screenshot bar; the other 20 assets are unmodified.
- `src/assets/css/site.css`: original styles plus narrowly scoped logo/nav, accessible accent contrast, and browser/zoom reflow corrections.
- `build.mjs`: dependency-free static build. Recreates all of `public/` from these sources.
- `scripts/check.mjs`: structural, navigation, asset and preview noindex checks.

## Homepage and subpages

The homepage retains **all original 12 sections** in original order. Internal section navigation, eight value-stream tiles, and existing CTA text link to independently addressable pages. No new public-facing marketing copy has been introduced.

- `/market/`, `/ecosystem/`, `/roots/`, `/science/`, `/make/`, `/package/`, `/move/`, `/sell/`, `/services/`, `/buyers/`, `/why-vegas/`, `/opportunities/`, `/contact/`.
- `#main` and `#top` remain only for skip-to-content and back-to-top accessibility operations; marketing/exploration links no longer scroll to homepage sections.
- MAKE and MOVE pages are intentionally concise because those categories were represented by cards, not full source sections. Their content is exclusively extracted or repeated from the source invitation.

## Content and deployment controls

The source's market sizing, program statements, external exhibitor inquiry destination (`cannacon.org`) and floor map link are preserved without verification or editorial changes. Confirm them before production. Local preview files are explicitly `noindex, nofollow, noarchive`, including `robots.txt: Disallow: /`. The standalone Worker enables indexable metadata and a sitemap only when requested through the approved `infused.show` domain; the Worker preview remains `noindex`.

The v1b.1 ZIP is a complete self-contained source baseline with `public/` excluded; the build regenerates it. **Do not overlay it on v1.x**. Extract into a fresh directory or archive/remove the old `infused_site` folder first. Production deployment, domain routing, and forms are out of scope.

## Current Cloudflare deployment architecture (October 31, 2026)

INFUSED uses **one public website Worker**, matching CannaCon's single-public-Worker pattern.

- infused.show/: dark Drop Journey homepage.
- infused.show/lander/: original light landing page, built into the same static asset bundle.
- www.infused.show: 308 redirect to the apex.
- dark.infused.show: noindex alias to the dark site.
- light.infused.show: redirect-only alias to /lander/; it does not serve a separate site.
- dropjourney/booth-attribution.mjs: first-party Map Dynamics handoff and anonymous click logging, using the same canonical D1 binding as the website.
- catalyst-revenue: shared Catalyst backend for SES and operational services. It is not a second INFUSED website Worker.

The retired infused-show Worker, its separate deployment workflow, and the light/booth service bindings have been removed. The single site Worker binds catalyst-audience-prod once and the existing catalyst-revenue / InfusedIntakeSESBridge service once. Ticket notifications remain disabled.

Build and validate from the repository root:

1. npm run build
2. npm run check
3. npm run test:w02
4. INFUSED_MODE=production node dropjourney/build.mjs
5. node dropjourney/scripts/qa_dark_worker.mjs
6. node scripts/verify-cloudflare.mjs

The only production deployment config is the root wrangler.toml. GitHub Actions deploys infused-dark after QA. No separate preview Worker is required.

## v1b.1 quality release

- Scope and exact audit findings: `release/V1B1_AUDIT_CHANGELOG.md`.
- Detailed QA and limitations: `release/QA_REPORT.md`.
- No copy, image ordering, category labels, navigation destinations or page hierarchy were changed.
- The now-obsolete one-time source bootstrap and workflow self-commit step were removed; the source is already in Git.
- The GitHub source branch is `infused-show`. The Cloudflare deployment workflow runs `npm run build` before publishing generated assets.

