# INF-3: INFUSED production cutover package

**Status:** Prepared for review. No production D1, production SES routing, light-host publication, apex/www reassignment or production deployment has been performed.  
**Date:** 2026-10-30  
**Prerequisite:** Complete the manual INF-2 Turnstile and system-notes acceptance in `INF-2_CANARY_ACCEPTANCE.md`. The synthetic SES outbox delivery is complete; the normal-browser form challenge remains open.  
**Production event facts:** May 13–14, 2027 / Las Vegas Convention Center (owner-confirmed 2026-10-30).

## 1. Current verified state

| Component | Current state |
|---|---|
| Public `infused.show` | `infused-show`, domain ID `82e9bbe668fd09f8b678189c4570efa1ab457037` |
| Public `www.infused.show` | `infused-show`, domain ID `90b7330f2221670d02094d03d7e16fde867f7d6f` |
| Public Worker deployment | `c79682ae-15cf-420e-88d9-6dc7e8a6558e` |
| Public Worker version | `f69bd0ee-3ad0-4bbb-8bc9-d756a70bfb2a` at 100% |
| Dark canary | `infused-dark`, deployment `a56ba5e8-5ade-40fc-84ed-4c5df7fb9da7`, version `5f639b2e-f1bd-4337-bacc-aeda6f7a4af0` |
| Canary hostname | `dark.infused.show`, domain ID `b8671e46ea9aa5aea523d566b8087a5563f74541` |
| Preview D1 | `infused-intake`, ID `13188d57-a463-445d-b341-9479ac3a4558`, US jurisdiction |
| Production intake D1 | Not created |
| SES relay Worker | `catalyst-revenue`, deployment `14a429c8-6293-420a-b8f8-465488630ef8`, version `87e65474-9758-4757-bac8-b01b3223b5a4` |
| SES D1 binding | Only `INFUSED_INTAKE_DB` exists; it points to preview D1 |
| Light-site host | `light.infused.show` not assigned |
| `LIGHT_HOST_PUBLISHED` | Not currently configured on `infused-show` |
| Ticket notifications | Disabled; keep disabled through cutover |

The public Worker and public domain assignments were rechecked after the canary deployment and remained unchanged.

## 2. Production data plane

1. Create a new Cloudflare D1 database named `infused-intake-production` in the US jurisdiction.
2. Apply the reviewed `dropjourney/migrations/0001_infused_native_intake.sql` migration.
3. Apply `0002_ticket_email_verification.sql` if retaining the ticket-notification schema for future use. Do not enable the ticket-notification API or email workflow.
4. Verify the production database has the expected tables, indexes, consent fields, unique request key and `test_record` flag.
5. Confirm the database is empty before cutover and record its UUID and time-travel bookmark.

Do not reuse `infused-intake`, `catalyst-audience-prod`, or another Catalyst database for production intake.

## 3. Private SES bridge separation

The current `InfusedIntakeSESBridge` reads only `env.INFUSED_INTAKE_DB`, which is the preview D1. It cannot safely serve production receipts until the service is extended.

Required additive change in `catalyst-event-data/services/catalyst-revenue`:

- Preserve `INFUSED_INTAKE_DB` as the preview database.
- Add `INFUSED_INTAKE_DB_PRODUCTION` as a separate D1 binding.
- Change `sendRequest` to accept only an allowlisted `environment` value (`preview` or `production`). Default omitted values to preview for backwards compatibility.
- Select the D1 binding from that fixed allowlist. Never accept an arbitrary database ID or recipient from the caller.
- Update the website Worker to call `sendRequest({id, environment})`.
- Verify the persisted row's `environment` matches the selected binding before sending.
- Preserve existing consent checks, idempotent outbox claim, attempt limits, uncertain-outcome handling, SES configuration, credentials, all existing Worker bindings and all cron schedules.
- Keep routing fail-closed: `test_record=1` or any non-production environment goes only to `lucas+system-notes@cannacon.org`; only `environment='production'` and `test_record=0` may route to `info@cannacon.org`.

Acceptance must use a synthetic `test_record=1` receipt in the production D1. Verify it reaches system notes, not `info@cannacon.org`. Do not send a production customer notification during acceptance.

## 4. Turnstile separation

The canary uses a dedicated widget restricted to `dark.infused.show`. The original widget remains restricted to `infused.show`.

Before production build:

1. Create a separate production widget authorized for `infused.show` and `dark.infused.show`.
2. Store its secret only as the `TURNSTILE_SECRET` Worker secret on `infused-dark`.
3. Completed source preparation: `dropjourney/src/intake-form.mjs` now accepts a build-time `TURNSTILE_SITEKEY` value and defaults to the canary sitekey when none is supplied.
4. Keep the canary build on its default canary sitekey; set `TURNSTILE_SITEKEY` to the production widget sitekey in the production build.
5. Do not commit either secret. Do not place secret values in GitHub source, workflow logs, build artifacts or documentation.

The ticket-notification form currently has a separate legacy sitekey. Ticket notifications remain disabled; if that feature is ever enabled, its widget and hostname policy must be reviewed separately.

## 5. Production Worker configuration

Build the production root assets and deploy the separate `infused-dark` Worker using `dropjourney/wrangler.dark-production.template.toml`, replacing the D1 placeholder only after the production database is created.

Expected settings:

- `SITE_MODE=production`
- `SITE_BASE_PATH=/`
- `SITE_ALLOWED_HOSTS=infused.show,dark.infused.show,www.infused.show`
- `INTAKE_ENVIRONMENT=production`
- `INTAKE_TEST_MODE=false`
- `TICKET_NOTIFY_ENABLED=false`
- `INTAKE_DB` bound to `infused-intake-production`
- `INTAKE_SES` bound to `catalyst-revenue / InfusedIntakeSESBridge`
- `BOOTH_ATTRIBUTION` bound to the existing `infused-show` Worker

Expected indexing behavior:

- `https://infused.show/`: indexable; canonical `https://infused.show/`; production sitemap.
- `https://dark.infused.show/`: noindex; canonical `https://infused.show/`.
- `https://www.infused.show/`: 308 redirect to `https://infused.show/`.
- Ticket sales and ticket notification remain disabled.

Do not reassign the public domains during this deployment step.

## 6. Preserve the light site

**Additional deployment dependency:** The PR branch contains the `LIGHT_HOST_PUBLISHED` gate and light-host canonical/robots behavior in `src/worker.mjs`, but the currently deployed `infused-show` version `f69bd0ee-3ad0-4bbb-8bc9-d756a70bfb2a` does not contain that code. The live Worker setting is also absent. Do not set the variable or attach `light.infused.show` until the light-host code has been released to the existing `infused-show` Worker. Prepare a narrow, separately reviewed light-host support release rather than merging the entire dark-site PR merely to obtain this code. The branch also contains a correction and regression test for the light-host `/tickets/` canonical URL.

Before moving the public domains:

1. Set `LIGHT_HOST_PUBLISHED=true` on the existing `infused-show` Worker.
2. Attach `light.infused.show` to `infused-show`.
3. Verify the light experience, canonical metadata, robots behavior and assets on that hostname.
4. Verify the existing `/go/booth` handoff still reaches the existing Map Dynamics destination and preserves campaign attribution.

The dark Worker uses a service binding to `infused-show` for booth attribution. Do not duplicate the existing audience database or Map Dynamics click-logging logic in `infused-dark`.

## 7. Pre-cutover evidence and owner gate

Capture immediately before cutover:

- Current public and dark Worker deployment/version IDs.
- All Worker custom-domain assignments and DNS records for `infused.show`.
- Public Worker settings, bindings, secrets names, schedules and current `LIGHT_HOST_PUBLISHED` value.
- Production D1 UUID, schema verification and time-travel bookmark.
- SES relay version, D1 bindings and routing test receipts.
- Production and canary Turnstile sitekeys/domains (never secret values).
- Current public page screenshots and route/header checks.
- Verified rollback instructions and operator availability.

Do not merge PR #33. Its base is `infused-show`, and merging would invoke the existing `deploy-infused.yml` workflow against the public Worker.

## 8. Cutover order

1. Confirm all INF-2 manual acceptance is closed.
2. Confirm the production D1, SES bridge and production Turnstile widget are ready.
3. Deploy and validate the production-mode `infused-dark` version while `dark.infused.show` remains the only domain on that Worker.
4. Confirm the existing `light.infused.show` experience is live on `infused-show`.
5. Obtain separate owner authorization for public-domain reassignment.
6. Detach `infused.show` and `www.infused.show` from `infused-show`, then attach both to `infused-dark`. Cloudflare custom-domain attachment manages the hostname routing and TLS; verify certificate readiness and HTTPS immediately after each attachment.
7. Verify the apex, www redirect, dark alias, light alias, canonical tags, robots, sitemap, all 16 routes, contact and buyer forms, D1 persistence, system-notes routing, booth attribution and disabled ticket state.

Expect a possible short transition interval while custom-domain ownership is transferred. Do not promise zero downtime without a rehearsed domain-transfer method.

## 9. Rollback

If post-cutover checks fail:

1. Detach `infused.show` and `www.infused.show` from `infused-dark`.
2. Reattach those hostnames to the existing `infused-show` Worker.
3. Verify public deployment `c79682ae-15cf-420e-88d9-6dc7e8a6558e` / version `f69bd0ee-3ad0-4bbb-8bc9-d756a70bfb2a` remains available at 100%.
4. Leave `light.infused.show` assigned to `infused-show` if it passed acceptance; otherwise detach it and revert `LIGHT_HOST_PUBLISHED`.
5. Keep `dark.infused.show` on the known canary version or detach it if the canary itself is unsafe.
6. Do not delete or restore the production D1. Preserve records for investigation.
7. Keep ticket notifications disabled and do not initiate customer or marketing email sends.

## 10. Explicitly not authorized by this package

This is a runbook and evidence package, not production authorization. It does not create the production D1, change the SES bridge, create the production Turnstile widget, publish the light host, reassign root/www, activate ticket notifications, change Stripe or Map Dynamics, or merge PR #33.
