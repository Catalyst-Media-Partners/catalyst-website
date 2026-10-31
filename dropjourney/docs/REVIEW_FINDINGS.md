# INFUSED | Full-site finishing and campaign-landings decision

Audit: 2026-10-28. Official sources: GitHub and Cloudflare only. Preview remains noindex and distinct from production.

## Confirmed live-site gaps and fixes

- WHAT chapter returned the visitor to the beginning on the primary Next and droplet actions. Replaced those main conversion actions with the existing exhibit-opportunities route. Kept an optional explicit reset in navigation.
- Make and Move have one canonical informational topic each. Do not fabricate additional category services. Give those short pages editorial media links to adjacent sourced categories and an obvious next step.
- Exhibit Opportunities had no visible inline image despite having six commercial offerings. Use its already approved source media in a real responsive figure.
- Buyer profile had no visual. Use an existing buyer meeting image without implying that a live application endpoint exists.
- Generic detail-page closing prompts now select an appropriate, visible CTA based on page purpose, not merely Continue.
- Normalize topic and commercial card text wrapping, line lengths and spacing; never truncate approved detail content to force matching card heights.

## Campaign architecture

- Five curated standalone HTML offer pages share one renderer and structured allowlist in `content/landers.json`: discover, exhibit, buyers, sponsor, attend.
- Portable HTML files embed the INFUSED logo, premium dimensional SVG water drop, CSS, and JS. No external scripts, hosted fonts, forms, dynamic offers, or third-party analytics.
- Same files are served at `/dropjourneytest/land/<slug>/` and exported under `exports/landers/infused-<slug>.html` for upload to Leadpages or static hosting.
- Each CTA and droplet navigates only to an approved INFUSED preview destination. UTMs are passed to the destination after strict key/value filtering; sender/recipient identifiers, arbitrary `next` URLs and automatic redirects are not accepted.
- Known offer IDs are generated at build time, giving campaign-specific first paint without client text-swapping flicker. No claims about a discount or registration availability are invented.
- Click the Drop is one click: tap the branded 3D SVG drop (220ms water response), then go directly to the intended next step. A prominent nonanimated CTA link is always visible. Reduced-motion users navigate instantly.

## Light vs dark

Keep one source-driven site and one production canonical path. Treat the dark experience as the brand's primary editorial presentation; light is a contextual campaign layout, not a duplicate full website. Campaign configuration permits a light variant for buyers or attendees without maintaining two sets of page copy. Production light site remains untouched until separate explicit authorization for cutover.

## SEO, tracking and distribution

All preview and campaign pages remain noindex/nofollow/noarchive with Cloudflare Worker response headers. Campaign reports should use known offer slug and standard UTM fields; SES click tracking is a separate configuration-set capability and is not automatically supplied by static landers. Leadpages 2026 supports HTML upload (5MB/page) but design editing of uploaded code may be limited by its platform. Do not move domains or provision DNS/SES based only on this design work. Preview is unlisted, not access controlled.

## Unresolved approvals

Current dates/venue/booth prices and availability remain as already published, but independent event-ops confirmations are outstanding. Ticket notification and buyer application endpoints are inactive. Production launch and email-domain tracking integration need separate explicit authorization.
