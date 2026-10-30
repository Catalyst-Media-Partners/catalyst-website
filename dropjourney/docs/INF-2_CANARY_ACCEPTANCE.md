# INF-2: INFUSED dark canary deployment and acceptance

**Status:** Canary deployed and hostname attached; automated browser acceptance and synthetic SES outbox delivery passed. One real-human Turnstile form submission remains unverified because the headless browser did not receive a token.  
**Date:** 2026-10-30  
**Candidate branch:** `release/infused-dark-production-inf1-20261030`  
**Latest deployment workflow run:** [GitHub Actions run #7](https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/41140461798)  
**Source commit used by latest deployment:** `7a88042c85a2fa1e38bb09d858c08a569ca0cb07`  
**PR validation:** both final workflows passed on this source commit (runs #49 and #33).

## Deployed canary resources

| Resource | Verified value |
|---|---|
| Worker | `infused-dark` |
| Current Worker deployment | `f2fac77e-3192-4de0-aca1-879ec583b729` |
| Current Worker version | `88ad6388-f163-4baf-ae4b-c3fcbd90c1f8` at 100% |
| Previous canary version | `38009d62-0fbf-4101-a497-ce0d621cbcbb` (retained as rollback target) |
| Earlier canary version | `2174b21d-c7da-4efa-b207-7b899d337394` (retained) |
| Initial canary version | `5f639b2e-f1bd-4337-bacc-aeda6f7a4af0` (retained) |
| Custom domain | `dark.infused.show` |
| Worker Domain ID | `b8671e46ea9aa5aea523d566b8087a5563f74541` |
| TLS certificate ID | `559e84bf-2928-45c8-8778-b564d8813a0d` |
| Turnstile sitekey | `0x4AAAAAAFtS3fhXx5j6zfT8` |
| Turnstile allowed host | `dark.infused.show` only |
| D1 | `infused-intake` / `13188d57-a463-445d-b341-9479ac3a4558` |
| SES service binding | `catalyst-revenue` / `InfusedIntakeSESBridge` |
| Booth attribution binding | Existing `infused-show` Worker |

The Turnstile secret is stored as the `TURNSTILE_SECRET` Worker secret. Its value is intentionally not recorded here. The intake form build now accepts `TURNSTILE_SITEKEY`; the canary build defaults to the dedicated canary sitekey.

## Canary runtime configuration

- `SITE_MODE=canary`
- `SITE_BASE_PATH=/`
- `SITE_ALLOWED_HOSTS=dark.infused.show`
- `INTAKE_ENVIRONMENT=preview`
- `INTAKE_TEST_MODE=true`
- `TICKET_NOTIFY_ENABLED=false`
- Scheduled outbox retry: `*/5 * * * *`
- No `workers.dev` URL or preview URL is enabled.
- No production D1 binding is present.

All new canary intake records are stored with `environment='preview'` and `test_record=1`. The private SES bridge routes those records to Lucas system notes, not the public `info@cannacon.org` inbox.

## Automated acceptance

The deployment workflow repeated the source checks, root-path build, native-intake synthetic matrix, dark Worker isolation tests and responsive/interaction browser QA before deployment. All steps passed.

## Live browser and HTTP checks

Verified against `https://dark.infused.show` after the custom domain was attached:

- Home, Market, Opportunities, Contact, Hosted Buyer Request and Tickets returned HTTP 200.
- Those pages carried `X-Robots-Tag: noindex, nofollow, noarchive`.
- HTML metadata declared `noindex, nofollow, noarchive` and canonical URLs on `https://infused.show`.
- Contact and Hosted Buyer forms used the dedicated dark-canary Turnstile sitekey.
- Each inspected content page had exactly one H1.
- `/robots.txt` returned HTTP 200 and `Disallow: /`.
- `/sitemap.xml` returned HTTP 404.
- An unknown route returned HTTP 404.
- The ticket notification button was disabled by the Worker status endpoint; the UI displayed “Email registration is temporarily unavailable.” `TICKET_NOTIFY_ENABLED` remained false.
- The canary hostname resolved through a Cloudflare-managed proxied AAAA record (`100::`) and the HTTPS browser request succeeded.

## Intake and notification checks

- A synthetic request with an invalid Turnstile token returned HTTP 403 / “Human verification failed”.
- D1 submission count remained unchanged at five after that rejected request. No unverified submission reached D1.
- A headless browser attempt did not receive a real Turnstile token. No live form submission was attempted and no user/customer data was created by that attempt.
- A separate synthetic outbox record was inserted directly into the isolated preview D1 (not through the web form) to exercise the canary Worker's scheduled private SES relay. The five-minute cron processed it: D1 outbox state is `sent`, attempts `1`, SES MessageId `010101a18ef86b4a-ba4f11cc-91c9-42d9-ae12-95fc62815740-000000`.
- Gmail receipt: [INFUSED Canary Outbox QA](https://mail.google.com/mail/u/?authuser=lucas%40cannacon.org#all/1a18ef86f58bf400), delivered to `lucas+system-notes@cannacon.org` with `[SYSTEM NOTE] [TEST]` subject prefix.
- A separate Gmail search for the same sender and inquiry subject at `info@cannacon.org` returned no messages.
- The existing October 29 SES bridge V&V also remains valid.

**Manual acceptance still required:** Open `https://dark.infused.show/contact/` in a normal browser, complete the managed Turnstile challenge and submit the clearly labeled synthetic acceptance request. Confirm the receipt, D1 row (`environment='preview'`, `test_record=1`), outbox state `sent`, and matching system-note email. Do not submit real customer data during this test.

## Booth attribution and rollback

- The deployed Worker has a service binding to the existing `infused-show` Worker.
- The passing `qa_dark_worker.mjs` test verified that `/go/booth` forwards to the existing light Worker and preserves the campaign parameters; the existing Worker remains responsible for the Map Dynamics redirect and click attribution.
- No live `/go/booth` click was generated because that would create a production acquisition event.
- The current canary deployment/version and previous version IDs above are retained as rollback anchors. A later deployment can be rolled back to version `38009d62-0fbf-4101-a497-ce0d621cbcbb` using the Worker deployment control. Detach Worker Domain ID `b8671e46ea9aa5aea523d566b8087a5563f74541` to remove the canary hostname if necessary. Do not detach or alter `infused.show` or `www.infused.show`.

## Production isolation confirmation

At completion of INF-2:
- `infused.show` and `www.infused.show` remained assigned to `infused-show`.
- The existing public Worker remained on deployment `c79682ae-15cf-420e-88d9-6dc7e8a6558e`, version `f69bd0ee-3ad0-4bbb-8bc9-d756a70bfb2a` at 100%.
- No root/www DNS or Worker domain assignment changed.
- PR #33 remains draft and unmerged.
- No production D1, production SES routing, ticket activation, Stripe, Map Dynamics or CannaCon configuration changed.

## Exit criteria for INF-3

INF-2 is technically deployed and isolated. Do not treat the canary as fully intake-accepted until the manual Turnstile/system-notes check is complete. The separate INF-3 production cutover package is maintained in `INF-3_PRODUCTION_CUTOVER_PACKAGE.md`.
