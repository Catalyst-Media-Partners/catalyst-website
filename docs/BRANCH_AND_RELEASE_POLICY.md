# Website Branch and Release Policy

**Effective:** 2026-10-29  
**Scope:** `Catalyst-Media-Partners/catalyst-website`

## Branch and deployment authority

- **`main` is the production source branch** for the separate `catalyst-website` Cloudflare Worker, which serves `catalystmediapartners.com` and `www.catalystmediapartners.com`.
- The `Deploy Catalyst merchant site to Cloudflare` workflow runs on pushes to `main`. It requires an owner-merged PR and a passing `validate` check before deployment. Do not bypass those controls or make direct production-source pushes.
- **`infused-show` is the standalone INFUSED Worker release branch.** Its deployment workflow targets the `infused-show` Worker and does not authorize changes to the Catalyst merchant site.
- **`infused-preview` is an isolated preview/QA track.** Its preview workflows must remain isolated from the production `infused-show` Worker, production D1, Stripe, and production customer routes. Do not merge preview work into production merely to synchronize branch histories.
- The branch roles are intentionally different. Their commit histories need not be identical; use a scoped PR and explicit release acceptance for any change that crosses these boundaries.

## Pull requests and releases

- A merged PR is not, by itself, proof that a deployment succeeded. Record the exact source commit, target Worker, CI/QA result, deployment ID or receipt, and rollback reference.
- Require the `validate` check to pass on the exact PR head before merging to `main`. Verify the post-merge deployment workflow and its independent Worker verification.
- Treat draft/closed PRs, old branches, and preview workflows according to their actual disposition and dependencies. Do not delete a branch until verifying that it has no open PR, unique unreconciled work, required QA evidence, rollback value, or active workflow reference.
- Preserve isolated preview and QA evidence before retiring one-time sprint branches or their workflow files.

## Repository retirement

- **Do not archive this repository** while the `catalyst-website` Worker continues to serve the two enabled Catalyst merchant-site hostnames.
- Repository retirement requires an approved migration/retirement plan, verified domain and Worker routing, a confirmed replacement source and deployment path, preserved release evidence, and removal or replacement of the current production deployment workflow.
- No open PRs were found in this repository during the 2026-10-29 hygiene scan. That does not make the repository or its `main` branch obsolete.

## Release inventory — 2026-10-29

The hygiene scan found no formal GitHub Releases or Git tags in this repository. Until a tag-based release convention is adopted, use the merged PR, exact commit SHA, passing checks, and deployment receipt as the release record.

## Change control

Changes to branch roles, deployment targets, custom-domain routing, or production workflow triggers require a separate migration plan, explicit review, a verified rollback path, and production acceptance. Do not treat repository hygiene as authorization to change production architecture.
