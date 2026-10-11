# Catalyst Media Partners Cloudflare cutover

## Scope: preserve merchant-reviewed content byte for byte

Authoritative web page: `index.html`, Git blob SHA-1 `2ae7b9911f9294202ef33d200fff17f95bd657fc`, 41,350 bytes.
Original image assets: `assets/catalyst-logo-dark.png`, `assets/catalyst-logo-light.png`, `assets/favicon.png`.
This release adds only build, verification, GitHub QA, and Cloudflare configuration. DO NOT edit merchant-facing wording, terms, contact info, event dates, links, colors or imagery without separately approved changes and merchant-review impact assessment.

## Architecture

- Repository target: `Catalyst-Media-Partners/catalyst-website`, preserve Git history on transfer from `PASS-LH/catalyst-website`.
- Cloudflare account: Catalyst_Media_Partners, ID `7fe07bc649cd7366b14ba607c115e895`.
- New Worker `catalyst-website`, **independent** of the CannaCon Worker.
- Static site generated into ignored `public/`: exact index.html + exact assets.
- Local/CI QA: `npm run check`, build: `npm run build`.
- Deployment publisher: only GitHub Actions (`.github/workflows/deploy-catalyst.yml`) may run Wrangler. Production merges must be owner-approved PRs with a passing `validate` check; direct pushes do not deploy. A scoped `CLOUDFLARE_API_TOKEN` repository secret must be added in the Catalyst organization repository. The PR workflow is read-only source QA. Cloudflare-native Workers Builds must remain disconnected for this Worker to prevent duplicate deployments.
- Do **not** additionally enable Cloudflare-native Git-connected production builds. `.github/workflows/source-qa.yml` is validation only; GitHub Actions `deploy-catalyst.yml` is the single publisher.
- Set org/branch protections to require `validate` before merge; no direct push to `main`.
- Workers.dev hostname can be used to verify the deployment **before** production DNS cutover.

## Cutover requirements

1. Verify source Git blob hash and exact asset parity after org transfer; merge QA and build config.
2. Add the scoped Cloudflare deploy token to GitHub Actions repository secrets; merge the tested deploy workflow, then verify the new Worker, workers.dev response, exact images, links, policies, mobile menu and HTTPS. If blocked by Cloudflare WAF, validate from a normal browser.
3. Create the `catalystmediapartners.com` zone in Catalyst Cloudflare account. Export and compare **all** current GoDaddy DNS records (MX, TXT SPF, DKIM, DMARC, CNAME, verification, SRV/subdomains). Do not change any existing Google Workspace routes.
4. Attach apex `catalystmediapartners.com` as Worker custom domain and `www.catalystmediapartners.com` by Worker custom domain or verified permanent redirect to apex. Check certificates.
5. Only after records and Worker routing are fully staged, update GoDaddy nameservers to Cloudflare's assigned pair. Domain registration remains at GoDaddy.
6. Verify live apex and www HTTP 200/301/HTTPS with the exact website, image assets, payment/policy links, canonical URL, SEO status, Google Workspace email, SPF/DKIM/DMARC, and no payment-script changes.
7. Observe propagation, keep old host enabled until verified stable, then manually cancel hosting after checking the actual cancellation/billing scope. CannaSite is not a required runtime dependency.

## Rollback

Retain prior GoDaddy DNS export, old nameservers/records, and old hosting through verification. Revert nameservers if required, or roll back Cloudflare Worker to the previous known-good version. Never disable email records, alter CannaCon, or silently revise merchant-account copy.

## Staging status 2026-10-11

- Existing `PASS-LH/catalyst-website` repository transferred into the `Catalyst-Media-Partners` GitHub organization without replacing the merchant-reviewed site.
- Cloudflare `Catalyst_Media_Partners` account now has pending zone `catalystmediapartners.com`, zone ID `0da2b23bb02ac40c23ac35a21e642c6b`.
- Cloudflare's authoritative nameservers assigned: `lorna.ns.cloudflare.com`, `luke.ns.cloudflare.com`. GoDaddy nameservers `ns67.domaincontrol.com`, `ns68.domaincontrol.com` must stay until site and email cutover checks pass.
- Initial DNS scan imported 17 existing records: A 2, MX 5, CNAME 3, TXT 7. Includes Google MX, Google DKIM, SPF, DMARC, domainconnect and external tracking record. **Two different DMARC policy TXT records exist at `_dmarc`, one `p=none`, one `p=quarantine`; resolve after examining current legitimate email senders before changing nameservers.** Do not infer which one is authoritative.
- A direct Cloudflare Workers Builds GitHub repo connection attempt returned account permission/installation error `8000008` after the GitHub ownership change. This plan therefore uses GitHub Actions as the only publisher. Do not add another Cloudflare-native publisher.
- One owner action remains: configure the Catalyst repo `CLOUDFLARE_API_TOKEN` Actions secret. Do not reuse unrelated secrets across companies; restrict Cloudflare token to the Catalyst account and Workers deployment permissions.
- Production DNS, GoDaddy registrar, CannaCon Worker, Catalyst site's existing host, mail and merchant content were not changed by repository/zone staging.
