# INF-1: Dark production source preparation

**Status:** Source candidate prepared; automated acceptance pending  
**Date:** 2026-10-30  
**Candidate branch:** release/infused-dark-production-inf1-20261030  
**Production baseline:** infused-show at 891e895913b6432162b4aa27fd49df6cc918fdbe  
**Preview source:** infused-preview at be79fc40baf95434e7cd7f0a96c313cf9bc20c6e

## Approved domain model

- infused.show: canonical dark Drop Journey.
- dark.infused.show: initial dark canary and later alias; noindex at all times, canonical points to infused.show.
- light.infused.show: preserved light marketing experience, served by the existing infused-show Worker after LIGHT_HOST_PUBLISHED=true and custom-domain assignment.
- www.infused.show: redirects to infused.show.

The existing root and www domain assignments remain unchanged during INF-1.

## Source isolation

The production baseline and Drop Journey preview branches share the same production site source tree. The preview branch is 103 commits ahead, but its changes are the separate Drop Journey subtree and preview-specific artifacts. To avoid merging the full preview branch history, this candidate branch was created from the exact production baseline and populated with the Drop Journey source subtree only. The production light site source remains the baseline except for narrowly scoped light-host alias support.

## Source changes

1. Build modes:
   - Preview remains the default and continues to build under /dropjourneytest/.
   - INFUSED_MODE=production builds at the site root under dist/production/.
   - Production pages receive canonical URLs on https://infused.show, indexable robots metadata and a 16-route sitemap.
   - Preview pages remain noindex and disallowed by robots.txt.
2. Intake:
   - Form actions use the selected build base.
   - Worker route, allowed host list, Turnstile hostname validation and source-page validation are configuration-driven.
   - Stored environment is preview unless INTAKE_ENVIRONMENT is explicitly production.
3. Ticket notification:
   - Ticket API paths are root/base aware.
   - TICKET_NOTIFY_ENABLED remains false in both canary and production templates.
   - The ticket notification workflow is not activated by this release.
4. Booth attribution:
   - The dark Worker forwards /go/booth to the existing infused-show Worker through a service binding.
   - The old Worker retains AUDIENCE_DB and the existing validated Map Dynamics redirect, so the dark Worker does not duplicate the audience database or click-logging logic.
5. Light host:
   - The existing light Worker source recognizes light.infused.show.
   - The alias returns 404 until LIGHT_HOST_PUBLISHED=true. No domain is assigned by INF-1.
6. Configuration:
   - wrangler.dark-canary.template.toml uses the existing preview D1 and explicit canary mode.
   - wrangler.dark-production.template.toml contains a production D1 placeholder and is deliberately non-deployable until INF-2 completes database and SES bridge separation.

## INF-2 prerequisites before canary deployment

- Create the new infused-dark Worker from the reviewed source.
- Add dark.infused.show to the Turnstile widget's hostname allowlist and provision a new Worker secret. Do not read or copy the existing secret.
- Confirm the preview D1 binding and the private SES bridge still reference the same preview database.
- Bind BOOTH_ATTRIBUTION to the existing infused-show Worker and verify it forwards to the existing Map Dynamics destination.
- Attach dark.infused.show only after all bindings and the TLS hostname are ready.
- Keep SITE_MODE=canary, INTAKE_ENVIRONMENT=preview and TICKET_NOTIFY_ENABLED=false.
- Complete real-browser Turnstile, D1, SES System Notes, booth-click attribution, responsive and accessibility acceptance.

## INF-3 prerequisites before root production cutover

- Create a separate production intake D1 database and apply the reviewed intake and ticket schema migrations.
- Update the private InfusedIntakeSESBridge to select the fixed production or preview D1 binding using an allowlisted environment parameter. It must never accept arbitrary database identifiers or recipients.
- Set the new Worker to SITE_MODE=production and INTAKE_ENVIRONMENT=production.
- Attach light.infused.show to the existing light Worker and set LIGHT_HOST_PUBLISHED=true.
- Reassign infused.show and www.infused.show to the dark Worker only after canary acceptance and rollback rehearsal.
- Preserve dark.infused.show as a noindex alias with canonical links to infused.show.

## INF-1 non-actions

No DNS, custom-domain, secret, production D1, production Worker deployment, SES identity, ticket-notification, Stripe, Map Dynamics or event-content changes were made in INF-1. No event dates, pricing or program claims were edited.

## Acceptance evidence expected

- Root production build and preview build both pass.
- All 16 route pages have exactly one H1 and valid metadata.
- Production canonical URLs and sitemap point only to infused.show.
- Preview and canary outputs remain noindex.
- Native form endpoints use the selected base path and verify the actual request hostname.
- Synthetic native intake tests persist exactly one receipt and one outbox item; mock SES is used in automated tests.
- Ticket notification remains disabled.
- Worker tests prove the booth handoff is forwarded to the existing Worker, not reimplemented.
- Existing light Worker tests prove light.infused.show remains disabled until explicitly enabled.
