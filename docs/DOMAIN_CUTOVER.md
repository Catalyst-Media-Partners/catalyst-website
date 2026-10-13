# INFUSED.SHOW domain and Worker handoff

Independent branch: `infused-show`. Dedicated Cloudflare Worker: `infused-show` in `Catalyst_Media_Partners` account. This has no dependency on Catalyst's public home page or Worker. The 14-page source remains the approved independent v1b.0 baseline.

Workers.dev preview: https://infused-show.cannacon-org-s-account.workers.dev/

## Steps for registrar/DNS cutover
1. Obtain registrar access and verify ownership, renewal settings and DNSSEC for `infused.show`.
2. Export current authoritative DNS, including ALL MX, SPF, DKIM, DMARC, TXT verifications, CNAME, mail and third-party records. Reconcile before nameservers are changed.
3. Create/activate Cloudflare zone for `infused.show` in the same account as the new Worker. A pending zone can be prepared before delegation.
4. After Cloudflare marks the zone active, attach Worker `infused-show` as the Custom Domain for `infused.show` and `www.infused.show` via Workers & Pages > Worker > Settings > Domains & Routes. The Worker redirects www to apex with a 308.
5. Ensure the Worker has an issued SSL certificate. Verify apex and www HTTPS, 14 pages, assets, redirects, SEO robots, sitemap, canonical metadata, and all contact, ticket and registration outbound destinations.
6. Approve production content, claimed metrics and images and complete accessibility/legal/privacy checks before activating production discovery.
7. Change registrar name servers to the assigned Cloudflare name servers ONLY after required existing DNS and mail services have been verified. Monitor for resolution, TLS, errors, and mail continuity.

## Separation and rollback
- The existing Catalyst Worker `catalyst-website`, Catalyst DNS, and repo main branch are untouched.
- The preview Workers.dev host remains noindex/nofollow/noarchive and disallows crawling; the future verified apex host enables indexing.
- The original independent v1b.0 ZIP and source are retained to reproduce the release.
- Rollback by redeploying previous `infused-show` commit and, if necessary, restoring registrar nameserver delegation only after confirming previous DNS and mail records.
