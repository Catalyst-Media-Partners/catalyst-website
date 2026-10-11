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
- Cloudflare Workers Builds should be the **sole** production publisher of this static Worker, configured after repository transfer. Root directory `/`; build command `npm run build`; deploy command `npx wrangler@4.138.0 deploy`; production branch `main`.
- Do **not** additionally configure GitHub Actions Wrangler deployment; `.github/workflows/source-qa.yml` is validation only.
- Set org/branch protections to require `validate` before merge; no direct push to `main`.
- Workers.dev hostname can be used to verify the deployment **before** production DNS cutover.

## Cutover requirements

1. Verify source Git blob hash and exact asset parity after org transfer; merge QA and build config.
2. Verify Cloudflare Worker deploy, live workers.dev response, images, links, policies, mobile menu and HTTPS. If protected by a Cloudflare WAF, validate from a normal browser.
3. Create the `catalystmediapartners.com` zone in Catalyst Cloudflare account. Export and compare **all** current GoDaddy DNS records (MX, TXT SPF, DKIM, DMARC, CNAME, verification, SRV/subdomains). Do not change any existing Google Workspace routes.
4. Attach apex `catalystmediapartners.com` as Worker custom domain and `www.catalystmediapartners.com` by Worker custom domain or verified permanent redirect to apex. Check certificates.
5. Only after records and Worker routing are fully staged, update GoDaddy nameservers to Cloudflare's assigned pair. Domain registration remains at GoDaddy.
6. Verify live apex and www HTTP 200/301/HTTPS with the exact website, image assets, payment/policy links, canonical URL, SEO status, Google Workspace email, SPF/DKIM/DMARC, and no payment-script changes.
7. Observe propagation, keep old host enabled until verified stable, then manually cancel hosting after checking the actual cancellation/billing scope. CannaSite is not a required runtime dependency.

## Rollback

Retain prior GoDaddy DNS export, old nameservers/records, and old hosting through verification. Revert nameservers if required, or roll back Cloudflare Worker to the previous known-good version. Never disable email records, alter CannaCon, or silently revise merchant-account copy.
