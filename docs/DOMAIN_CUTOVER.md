# INFUSED.show | Cutover readiness (2026-10-13)

**Approved site:** independent INFUSED v1b.0, 14 pages, source SHA-256 archive `cc1afa9cfc6f233cb6aab725db5d6ddf236bf639f82327e37721f338162a0c04`.

**Source:** GitHub branch `infused-show` in `Catalyst-Media-Partners/catalyst-website`. `main` and Catalyst Worker remain unchanged. Generated `public/` is recreated by `npm run build`.

**Deployed preview:** https://infused-show.cannacon-org-s-account.workers.dev/  
**Worker:** `infused-show`, Cloudflare account `Catalyst_Media_Partners`. Deployed by the branch's GitHub Actions workflow. Preview host is noindex/nofollow/noarchive.

## Already configured in Cloudflare

- Zone `infused.show` created in the Catalyst account; status **pending** until registrar delegation.
- Cloudflare assigned nameservers `lorna.ns.cloudflare.com` and `luke.ns.cloudflare.com`.
- Previous observed nameservers are `ns63.domaincontrol.com` and `ns64.domaincontrol.com`.
- Worker Custom Domains attached to `infused.show` **and** `www.infused.show`, enabled; Cloudflare created the proxied originless AAAA entries automatically.
- Worker returns 308 redirect from www to the apex. On the approved apex hostname, it switches preview `noindex` metadata to production canonical/indexable metadata and serves a generated 14-URL sitemap/robots rules.
- Universal SSL is enabled and zone TLS mode is full. Domain certificates have identifiers, but cannot be treated as valid until zone activation and real HTTPS tests.

## Scanned legacy DNS and staging

Cloudflare's asynchronous DNS scan found six legacy records: two website A records pointing to old hosting, plus `_acme-challenge`, `_domainconnect`, `_dmarc` and `pay.infused.show`. The four **non-web** records were copied into the pending zone without changing their values or proxy settings. The old website A records were NOT copied because they conflict with the staged Worker originless routing. The current pending zone therefore contains six DNS records: two Worker AAAA entries plus the four preserved non-web records.

No MX, SPF, or DKIM records were found in the automatic scan. **That does not prove they do not exist.** The registrar's authoritative DNS export and email requirements must be checked before any nameserver change. DNSSEC DS records at the registrar must also be reviewed.

## Remaining actions (registrar/DNS handoff)

1. Obtain authorized control of the `infused.show` registrar account.
2. Export ALL authoritative DNS records and verify mail, third-party services, subdomains and DNSSEC. Reconcile any missing records in Cloudflare; do not assume Cloudflare's automated scan is exhaustive.
3. Check that the existing legacy site and required integrations can safely be retired or redirected.
4. Once the pending zone is complete, update ONLY the registrar's nameserver delegation to `lorna.ns.cloudflare.com` and `luke.ns.cloudflare.com`.
5. Wait for zone activation and SSL certificate issuance. Verify HTTPS at both apex and www; confirm www redirects to apex.
6. Test all 14 routes, CSS/images, form and ticket destinations, metadata, mobile behavior, and external inquiry links on `infused.show`. Confirm facts, imagery permission, privacy and accessibility checks before marketing launch.
7. Monitor mail delivery, 404s, crawler indexing and error rates. Do not disable old hosting until final verification.

**Never change `catalystmediapartners.com` or `cannacon.org` production DNS, Worker, or GitHub main branch as part of this cutover.**

## Rollback

Maintain the registrar DNS export, former hosting settings, and v1b.0 full ZIP. Roll Worker code back by deploying an earlier `infused-show` commit. If nameserver rollback is required, restore the previous complete DNS zone and validate mail/HTTPS before changing delegation.
