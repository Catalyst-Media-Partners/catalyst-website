# INFUSED v1b.0 hidden preview on Catalyst

This is a static staging-only addition to Catalyst's existing merchant-reviewed site. The original `index.html`, `assets/`, `wrangler.toml`, Cloudflare domain assignments and GitHub approval-gated release workflow are unchanged.

Once approved/merged by the authorized repository owner and deployed through the existing production workflow:
- Preview: https://catalystmediapartners.com/infused-preview/
- 13 subpages use https://catalystmediapartners.com/infused-preview/<section>/
- No Catalyst navigation links are added.
- Preview responses receive `X-Robots-Tag: noindex, nofollow, noarchive` and `Cache-Control: no-store` via the Workers static assets `_headers` file.
- Infused HTML already includes a `noindex, nofollow, noarchive` robots meta directive.
- No password barrier is installed. Anyone who knows the URL can visit. Do not share until ready.

Build uses pinned archive `Infused_Website_v1b.0_full.zip` as the source of truth (SHA-256 `cc1afa9cfc6f233cb6aab725db5d6ddf236bf639f82327e37721f338162a0c04`), stored in 30 GitHub source pieces to bypass connector upload limits. `node scripts/stage-infused-preview.mjs` reconstructs and checks the archive, extracts only `infused_site/public/`, then stages the files to `public/infused-preview/`. Generated `public/` is NOT committed. No Infused source changes were made.

`npm run check` preserves original exact merchant-site SHA, original assets, release workflow checks, and generated output verification, then validates all 14 preview pages and its assets. CI is still responsible for running this check. Production deployment requires an authorized merge and passing validation.

Rollback: revert this PR commit using the existing gated workflow. The original Catalyst source is unchanged. If a secret/password preview is needed, replace this public-by-URL approach with Cloudflare Access before approval.
