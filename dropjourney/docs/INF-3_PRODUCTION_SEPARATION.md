# INF-3: INFUSED production separation and dark-host release

**Status:** Production data plane deployed to `dark.infused.show` in synthetic acceptance mode. Canonical apex/www cutover is intentionally reserved for INF-4.  
**Date:** 2026-10-30/31  
**Production event facts:** May 13–14, 2027 / Las Vegas Convention Center (owner-confirmed 2026-10-30).

## 1. Completed production resources

| Resource | Verified state |
|---|---|
| Production intake D1 | `infused-intake-production`, UUID `2082f84e-bacd-4ef2-8902-265eda67e4d1`, US jurisdiction / WNAM primary |
| Production D1 schema | `0001_infused_native_intake.sql` applied; intake and outbox tables created |
| Production SES bridge | `catalyst-revenue`, deployment `00e89586-5c17-4985-abb0-0d8b6df8a07a`, version `dc7bbdb7-e737-4a31-aa00-3d8a781910e6` at 100% |
| Production SES D1 binding | `INFUSED_INTAKE_DB_PRODUCTION` → production D1 |
| Preview SES D1 binding | `INFUSED_INTAKE_DB` → existing preview D1 |
| SES routing | Explicit `environment` selects database; missing legacy environment defaults to preview only; persisted row environment must match |
| Synthetic routing | Preview and `test_record=1` receipts go to Lucas system notes; only production non-test records go to `info@cannacon.org` |
| Production Turnstile | Sitekey `0x4AAAAAAFthzCYCdmh8aVv8`, managed widget restricted to `infused.show` and `dark.infused.show` |
| Production Turnstile secret | Stored on `infused-dark` as `TURNSTILE_SECRET_PRODUCTION`; value is not stored in GitHub |
| Canary Turnstile | Separate widget/secret remains available for the isolated canary |
| Light Worker | `infused-show`, deployment `ed6cd084-1627-4b70-9f9c-72d3020dba99`, version `844e2c34-ce89-4ee8-a100-715d6bb47a11` at 100% |
| Light host gate | `LIGHT_HOST_PUBLISHED=true` |
| Light host | `light.infused.show`, Worker Domain ID `621f43b4338e383d5a60b00447466b44c71ee99f` |

## 2. Current domain ownership

| Hostname | Worker | State |
|---|---|---|
| `infused.show` | `infused-show` | Existing light site remains canonical |
| `www.infused.show` | `infused-show` | Existing redirect to apex remains |
| `light.infused.show` | `infused-show` | Live preserved light experience |
| `dark.infused.show` | `infused-dark` | Production-data acceptance site; noindex |

The root and www domains have not been transferred. This is intentional. INF-3 prepares the production data plane and dark Worker; INF-4 is the separate root/www domain cutover.

## 3. Production Worker acceptance configuration

Current `infused-dark` deployment:
- Deployment: `a56a84b4-d09c-4dc2-a791-6695ee3b19dd`
- Version: `8c9d3280-352a-4cfa-b5f3-74454dff3628` at 100%
- `SITE_MODE=canary`
- `SITE_ALLOWED_HOSTS=dark.infused.show`
- `SITE_BASE_PATH=/`
- `INTAKE_ENVIRONMENT=production`
- `INTAKE_TEST_MODE=true`
- `TICKET_NOTIFY_ENABLED=false`
- `INTAKE_DB` → production D1
- `INTAKE_SES` → `catalyst-revenue / InfusedIntakeSESBridge`
- `BOOTH_ATTRIBUTION` → existing `infused-show`

The site is noindex while acceptance is in progress. All form submissions are marked synthetic and route to system notes, not the public inquiry inbox.

## 4. Automated acceptance completed

- Production-root build and structural QA passed.
- Responsive and interaction QA passed across 26 desktop/tablet/mobile cases.
- Live Contact page renders the production Turnstile sitekey and canonical metadata.
- Deliberately invalid Turnstile token returned HTTP 403 / `Human verification failed`.
- Production D1 row count remained zero after the invalid-token request.
- `light.infused.show` returns HTTP 200, is indexable, uses light-host canonical URLs, and has a light-host sitemap.
- Light-host `/tickets/` canonical URL is verified; ticket notifications remain disabled.
- Public apex/www domains remain on the existing light Worker.

## 5. Manual acceptance gate still open

A real browser must complete the managed production Turnstile challenge on:

`https://dark.infused.show/contact/`

Use only synthetic data:
- Name: INFUSED Production Acceptance QA
- Email: `infused-production-acceptance@example.com`
- Company: Catalyst Synthetic QA
- Topic: General
- Message: Synthetic production acceptance test only; not a customer inquiry.
- Required contact consent: checked
- Marketing consent: unchecked

Expected result:
1. Browser receives a receipt ID.
2. Production D1 row has `environment='production'` and `test_record=1`.
3. SES outbox reaches `sent`.
4. Matching `[SYSTEM NOTE] [TEST]` email arrives at `lucas+system-notes@cannacon.org`.
5. No matching message is sent to `info@cannacon.org`.

A direct synthetic outbox record is also being used to validate the production SES relay; it is not a substitute for the normal-browser Turnstile/form test.

## 6. Complete INF-3 after manual acceptance

After the manual form test and system-note delivery are confirmed:
1. Change `dropjourney/deploy-mode` from `acceptance` to `production`.
2. The production rollout workflow deploys `wrangler.dark-production.template.toml`.
3. Verify `SITE_MODE=production`, `INTAKE_TEST_MODE=false`, `INTAKE_ENVIRONMENT=production`, production D1 binding, production Turnstile secret, SES bridge and disabled ticket notifications.
4. Verify `dark.infused.show` remains noindex/canonical to `infused.show`.
5. Verify `infused.show` and `www.infused.show` remain assigned to `infused-show`; `light.infused.show` remains live.

Do not move the apex/www domains in INF-3.

## 7. Next sprint: INF-4 root/www cutover

INF-4 is the next major website sprint after INF-3. It transfers `infused.show` and `www.infused.show` from `infused-show` to `infused-dark`, while preserving the light site at `light.infused.show`. It requires INF-3 acceptance, production-mode deployment, verified rollback IDs, and separate explicit cutover approval. See `INF-4_ROOT_DOMAIN_CUTOVER.md`.

Ticket notifications remain disabled. No Stripe, Map Dynamics, CannaCon, or audience database changes are part of INF-3.
