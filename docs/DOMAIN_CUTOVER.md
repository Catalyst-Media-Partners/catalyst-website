# infused.show standalone hosting cutover | current architecture verified 2026-10-31

## Current deployment source of truth

- GitHub: Catalyst-Media-Partners/catalyst-website, source branch infused-show.
- Public INFUSED website Worker: infused-dark only.
- Shared backend: catalyst-revenue, also used by CannaCon. It is not a second website Worker.
- Root config: wrangler.toml; static assets: dropjourney/dist/production/.
- Canonical production D1: catalyst-audience-prod, ID 4fc7440c-c340-47c4-a75f-96f4e7ad7441. The site binds it once as INTAKE_DB.
- Private email service: INTAKE_SES -> catalyst-revenue / InfusedIntakeSESBridge.
- infused.show/: dark Drop Journey.
- infused.show/lander/: original light landing page, embedded in the same Worker asset bundle. It shares the root /assets/ directory and has its own canonical URL.
- www.infused.show: 308 redirect to apex.
- dark.infused.show: noindex alias to the dark experience.
- light.infused.show: redirect-only alias to https://infused.show/lander/.
- Booth attribution runs inside the site Worker and writes to the canonical D1 table web_acquisition_clicks_v1. No service binding to another website Worker exists.
- The old infused-show Worker and its independent deployment workflow are retired. The root wrangler.toml is the only deployment configuration for the public site.

Build order: npm run build, npm run check, npm run test:w02, then INFUSED_MODE=production node dropjourney/build.mjs. The single production deployment is performed by .github/workflows/deploy-infused-dark-production.yml after QA. Ticket notifications remain disabled. No DNS records or registrar nameservers are changed by this Worker consolidation.

## GoDaddy DNS cutover

The Cloudflare zone `infused.show` is **pending** until the registrar delegates to its assigned nameservers:

    lorna.ns.cloudflare.com
    luke.ns.cloudflare.com

Currently published nameservers (public DNS):

    ns63.domaincontrol.com
    ns64.domaincontrol.com

On GoDaddy: Domain Portfolio > `infused.show` > DNS > Nameservers > I'll use my own nameservers > enter the TWO Cloudflare values above > Save > Continue. Identity confirmation or two-factor verification may be required. Do not change A, AAAA or NS DNS-record rows individually instead of the registrar's actual nameserver delegation.

Before saving, export the complete GoDaddy authoritative DNS record set, and confirm domain renewal/ownership. The public DNS and Cloudflare rescan on 2026-10-14 returned the legacy website at `159.65.170.238`, no apex MX, no apex TXT and no parent-zone DS records. These findings do not prove that no undocumented subdomain or email integration exists. Confirm the registrar's complete list and any domain-level forwarding settings.

**Cloudflare staged zone records:** two proxy-enabled Worker AAAA placeholders at apex and www; the original `_acme-challenge` CNAME, `_domainconnect` CNAME, `_dmarc` TXT, and `pay` CNAME all preserved. Public queries verified that the three CNAMEs and DMARC TXT value match the original registrar records. The two old origin A records are intentionally NOT copied because the Worker handles apex and www. Existing payment subdomain `pay.infused.show` points to `paylinks.commerce.godaddy.com` (DNS-only) and must not be removed without approval.

## Verified legacy URL redirects (release v1b.2)

All redirects preserve URL query parameters:

| Former WordPress URL | New site destination |
| --- | --- |
| `/getting-started/` | `/` |
| `/event/las-vegas-2027/` | `/` |
| `/exhibit/` | `/opportunities/` |
| `/exhibitor-hub/` | `/opportunities/` |
| `/become-an-exhibitor/` | `/contact/` |
| `/become-a-speaker/` | `/contact/` |
| `/become-a-sponsor/` | `/opportunities/` |

These are legacy fallbacks, not new content claims or new speaker/sponsor application forms. Current conversion actions on the approved site continue to use the existing CannaCon exhibitor request and Map Dynamics URLs.

## Open migration decisions

1. **Privacy policy:** The former `/privacy-policy/` is a WordPress-specific 2025-edited policy (mentions comments, Gravatar, WordPress login cookies and form retention), not an accurate policy for this new low-dependency site. It has NOT been copied or redirected. Have the correct owner approve replacement privacy content, then add an appropriate `/privacy-policy/` route. Do not silently reuse stale legal language.
2. **Legacy hosted-buyer PDF:** The previous homepage advertised `/wp-content/uploads/INFUSED_Hosted_Buyer_Clickable_Form_15_Meetings.pdf`. The new site does not host this document. Confirm whether it still needs to be publicly accessible; if yes, obtain the approved source and preserve the filename/path or provide a verified redirect before retiring old hosting.
3. **Old event-page anchors:** Inbound links to `#schedule`, `#speakers`, `#tickets` etc. will redirect to the general homepage; the approved site has no equivalent independently confirmed schedules or ticket flow. Validate marketing links before sending traffic.
4. The legacy WordPress provider should remain available for rollback until DNS, TLS, routing, outbound flows and privacy obligations are verified. Do not cancel the old hosting on the same day as the nameserver change.

## After registrar nameserver switch

1. Confirm public `NS` delegation to both and only the assigned Cloudflare nameservers.
2. Confirm Cloudflare zone transitions from **pending** to **active**. If still pending after propagation, use the zone's **Check nameservers now** control. Recheck any registrar DS records if needed.
3. Confirm universal SSL certificate issuance. Test `https://infused.show/` and `https://www.infused.show/` over HTTPS; www must redirect to apex with 308.
4. Test all 14 HTML routes, 21 image assets and CSS, header, ecosystem categories, mobile and desktop navigation, contact CTA and floor-map links.
5. Test the seven legacy redirects, old URL UTM propagation, `robots.txt`, `sitemap.xml`, canonical tags, preview noindex and production indexing metadata.
6. Confirm `pay.infused.show`, third-party services, email requirements, and domain renewal access remain correct.
7. Monitor 404s, conversions, mail and TLS for at least 24 hours before decommissioning WordPress.

## Recovery

Keep the old GoDaddy DNS export, current legacy origin address, and source ZIP. Roll back a Worker code regression by redeploying the previous `infused-show` GitHub commit. If the entire DNS cutover must be reversed, restore the full former authoritative GoDaddy DNS records and its nameserver delegation, allow DNS caching to expire, and retest HTTPS, mail and payments. Cloudflare and the domain registrar are separate: nameserver change does NOT transfer registration away from GoDaddy.

Do not store credentials in the repository, upload them to Cloudflare, paste them into CI, or disclose them in deployment notes. Enable MFA and review delegated business access to the GoDaddy domain account after the change.
