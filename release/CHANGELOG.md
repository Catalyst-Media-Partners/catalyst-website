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
