# INF-4: INFUSED root/www domain cutover

**Status:** Prepared; not authorized or executed.  
**Prerequisite:** INF-3 production separation and manual production Turnstile/system-notes acceptance are complete.  
**Scope:** Move only `infused.show` and `www.infused.show` from the existing light Worker to `infused-dark`; preserve the light experience at `light.infused.show`.

## 1. Verified starting state

| Hostname | Current Worker | Required final Worker |
|---|---|---|
| `infused.show` | `infused-show` | `infused-dark` |
| `www.infused.show` | `infused-show` | `infused-dark` |
| `light.infused.show` | `infused-show` | `infused-show` |
| `dark.infused.show` | `infused-dark` | `infused-dark` |

Current preserved light Worker:
- Deployment `ed6cd084-1627-4b70-9f9c-72d3020dba99`
- Version `844e2c34-ce89-4ee8-a100-715d6bb47a11` at 100%
- `LIGHT_HOST_PUBLISHED=true`
- Light custom domain ID `621f43b4338e383d5a60b00447466b44c71ee99f`

Current dark Worker canary/acceptance rollback anchor:
- Worker `infused-dark`
- Acceptance deployment `a56a84b4-d09c-4dc2-a791-6695ee3b19dd`
- Acceptance version `8c9d3280-352a-4cfa-b5f3-74454dff3628`

The exact production-mode deployment/version IDs must be captured after INF-3 switches `deploy-mode` to `production`. Use those IDs as the cutover rollback anchor.

## 2. Preconditions

Do not begin until every item is true:
- [ ] INF-3 production data-plane acceptance is complete.
- [ ] Normal-browser Contact form passed the production Turnstile challenge.
- [ ] Production D1 row is `environment='production'`, `test_record=1` for the synthetic test.
- [ ] SES outbox reached `sent`; matching system-note email received.
- [ ] No corresponding synthetic message reached `info@cannacon.org`.
- [ ] Final `infused-dark` production version is deployed at 100% with `INTAKE_TEST_MODE=false`.
- [ ] `light.infused.show` renders the light site with canonical URLs on the light host, indexable robots and sitemap.
- [ ] `infused.show` still serves the existing light site and `www.infused.show` still redirects to apex.
- [ ] Current deployment IDs, Worker bindings, custom-domain assignments and DNS records have been captured.
- [ ] Rollback operator and availability are confirmed.

## 3. Expected final dark Worker configuration

- `SITE_MODE=production`
- `SITE_BASE_PATH=/`
- `SITE_ALLOWED_HOSTS=infused.show,dark.infused.show,www.infused.show`
- `INTAKE_ENVIRONMENT=production`
- `INTAKE_TEST_MODE=false`
- `TICKET_NOTIFY_ENABLED=false`
- `INTAKE_DB` → `infused-intake-production`
- `INTAKE_SES` → `catalyst-revenue / InfusedIntakeSESBridge`
- `BOOTH_ATTRIBUTION` → existing `infused-show`

The Worker must keep:
- Apex `infused.show` indexable with canonical `https://infused.show/`.
- `dark.infused.show` noindex with canonical `https://infused.show/`.
- `www.infused.show` returning HTTP 308 to apex.
- Ticket sales and ticket notifications disabled.

## 4. Cutover sequence

1. Capture final pre-cutover state: public and dark Worker deployment/version IDs, bindings, schedules, secrets names, D1 UUIDs, custom domains, DNS records and current live screenshots.
2. Confirm `light.infused.show` is live on `infused-show` and `LIGHT_HOST_PUBLISHED=true`.
3. Confirm `infused-dark` is on its final production version at 100%.
4. Detach `infused.show` from `infused-show`.
5. Attach `infused.show` to `infused-dark`; wait for the managed TLS certificate and verify HTTPS.
6. Detach `www.infused.show` from `infused-show`.
7. Attach `www.infused.show` to `infused-dark`; wait for the managed TLS certificate and verify HTTPS.
8. Do not change `light.infused.show` or `dark.infused.show`.
9. Verify apex, www redirect, dark alias and light alias immediately after each domain transfer.

Cloudflare custom-domain reassignment can cause a short transition interval. Do not promise zero downtime without a rehearsed transfer method. Do not change zone-wide DNS records or unrelated hostnames.

## 5. Post-cutover verification

- [ ] `https://infused.show/` returns the dark INFUSED site, HTTP 200, indexable, canonical to apex.
- [ ] `https://www.infused.show/` returns HTTP 308 to `https://infused.show/`.
- [ ] `https://dark.infused.show/` returns the dark site, noindex, canonical to apex.
- [ ] `https://light.infused.show/` returns the preserved light site, indexable, canonical to light host.
- [ ] Apex sitemap contains the 16 published dark routes and canonical URLs on `infused.show`.
- [ ] Apex robots allows indexing; dark alias robots disallows indexing; light robots/sitemap remain light-host scoped.
- [ ] All 16 routes, assets, mobile breakpoints and navigation pass.
- [ ] Contact and Hosted Buyer forms render the production Turnstile sitekey.
- [ ] Invalid Turnstile tokens are rejected without D1 writes.
- [ ] Production intake rows use production D1; preview remains isolated.
- [ ] Production SES test routing remains correct; synthetic rows go to system notes, non-test production rows go to `info@cannacon.org`.
- [ ] `/go/booth` handoff still reaches the existing Map Dynamics destination and preserves attribution.
- [ ] Ticket notifications remain disabled.
- [ ] No Stripe, checkout, Map Dynamics, CannaCon admin or audience database changes occurred.

## 6. Rollback

If any critical post-cutover check fails:
1. Detach `infused.show` and `www.infused.show` from `infused-dark`.
2. Reattach both to `infused-show`.
3. Verify the preserved light Worker is still at deployment `ed6cd084-1627-4b70-9f9c-72d3020dba99` / version `844e2c34-ce89-4ee8-a100-715d6bb47a11` at 100%, or use the exact newer version captured before cutover.
4. Leave `light.infused.show` on `infused-show`.
5. Keep `dark.infused.show` on the verified production dark version or revert to the acceptance version if the production version is unsafe.
6. Do not delete or restore production D1; preserve all records for investigation.
7. Keep ticket notifications disabled and do not initiate customer/marketing email sends.

## 7. Explicit non-actions

INF-4 does not include activating ticket notifications, Stripe checkout changes, Map Dynamics configuration changes, new audience ingestion, CannaCon forms or SEO/campaign work. Those are separate sprints.
