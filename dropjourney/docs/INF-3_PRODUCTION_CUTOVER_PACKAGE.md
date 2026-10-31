# INFUSED rollout runbooks — superseded file

This filename was created before the day-start sprint plan separated production data-plane preparation from canonical root/www transfer.

Use the two current, controlling runbooks:
- `dropjourney/docs/INF-3_PRODUCTION_SEPARATION.md` — production D1, SES bridge, Turnstile, dark Worker production configuration, acceptance, and release boundary.
- `dropjourney/docs/INF-4_ROOT_DOMAIN_CUTOVER.md` — separate apex/www domain transfer, light-site preservation, post-cutover verification, and rollback.

**Current domain boundary:** `infused.show` and `www.infused.show` remain on `infused-show`; `light.infused.show` is now live on `infused-show`; `dark.infused.show` is on `infused-dark`. Do not execute INF-4 until INF-3 acceptance is complete and the separate root/www cutover is authorized.

The original file is retained as a historical reference only.