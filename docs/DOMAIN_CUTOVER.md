# infused.show standalone hosting cutover | verified 2026-10-14

## Deployment source of truth

- GitHub: `Catalyst-Media-Partners/catalyst-website`, independent branch `infused-show`. Do NOT merge this into Catalyst `main` or deploy to Catalyst's Worker.
- Infused release: v1b.2 migration hardening, preserving all 14 approved v1b.1 pages and their public content, images and links.
- Build: `npm run build` regenerates ignored `public/`; `npm run check`; `node scripts/verify-cloudflare.mjs`.
- GitHub Actions: `.github/workflows/deploy-infused.yml`; push to `infused-show` with authorized repository actor deploys ONLY Worker `infused-show` in Cloudflare account `Catalyst_Media_Partners`.
- Cloudflare Worker: `infused-show` with Workers static assets, `keep_vars = true`, and unchanged account binding.
- Preview: `https://infused-show.cannacon-org-s-account.workers.dev/`. Preview host disallows indexing.
- Production hostnames already assigned as custom Worker domains: `infused.show` and `www.infused.show`; www issues a 308 redirect to the apex. The Worker serves production-only canonical links, a 14-URL sitemap, and allow-indexing robots metadata upon receiving the production hostname.

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
