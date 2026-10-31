# INFUSED single-Worker consolidation | 2026-10-31

## Decision

INFUSED has one public website Worker, matching the CannaCon public-site architecture. The prior split was an implementation shortcut, not a platform requirement.

## Before

- infused-dark served the dark Drop Journey and proxied /lander/ to infused-show.
- infused-show separately hosted the light static site, AUDIENCE_DB, and booth-attribution endpoint.
- infused-dark had LIGHT_SITE and BOOTH_ATTRIBUTION service bindings back to infused-show.
- Two GitHub deployment workflows published the same INFUSED source branch to different public Workers.
- The original light landing page assets were fetched over a Worker-to-Worker service binding.

## After

- infused-dark is the only public INFUSED website Worker.
- Dark design: https://infused.show/.
- Light design: https://infused.show/lander/, served from the same ASSETS binding.
- The light landing page uses shared /assets/images/ and its own /assets/css/site.css and /assets/js/cta-attribution.js files in that same asset bundle.
- light.infused.show is a redirect-only alias to /lander/.
- dark.infused.show remains a noindex alias; www.infused.show redirects to apex.
- Booth attribution runs directly in dropjourney/booth-attribution.mjs and writes to the canonical web_acquisition_clicks_v1 table.
- One D1 binding: INTAKE_DB -> catalyst-audience-prod (4fc7440c-bacd-4ef2-8902-265eda67e4d1).
- One shared backend binding: INTAKE_SES -> catalyst-revenue / InfusedIntakeSESBridge.
- The old infused-show Worker and duplicate deployment workflows/configurations are retired.

## Preserved

- Existing apex, www, and dark hostname behavior.
- Original light landing-page copy and design.
- Map Dynamics destination and booth click attribution schema.
- Canonical D1 data and existing catalyst-revenue service.
- Turnstile secrets, protected runtime configuration, five-minute intake outbox cron.
- Ticket notification feature remains disabled.
- No DNS records, registrar nameservers, Stripe settings, Salesforce settings, or checkout configuration are changed.

## Release acceptance

- Build both source designs into one static asset directory.
- Verify dark root, /lander/, shared CSS/JS/image assets, canonical and robots metadata.
- Verify /lander/ CTA attribution writes one row to the canonical D1 and redirects to the existing Map Dynamics destination.
- Verify light.infused.show redirects to /lander/.
- Verify infused-dark has exactly one D1 binding and one private SES service binding, with no LIGHT_SITE or BOOTH_ATTRIBUTION binding.
- Move light.infused.show to infused-dark only after the root Worker passes smoke tests.
- Delete infused-show only after the hostname is moved and the new redirect is verified.
- Confirm all four INFUSED hostnames are assigned to infused-dark and the old Worker script no longer exists.

