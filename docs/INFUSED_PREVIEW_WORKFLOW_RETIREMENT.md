# INFUSED Preview Workflow Retirement Record

**Date:** 2026-10-29  
**Scope:** Retire completed sprint-specific deployment workflows from the `infused-preview` branch only.

## Decision

The sprint-specific preview deployments have completed and their feature PRs are merged into `infused-preview`. The general `deploy-dropjourney-review.yml` workflow remains the supported preview QA/deployment path for `infused-preview` and its pull requests. The one-off S02, S03, S04, S05, and S10 workflows are no longer needed on the shared preview branch.

This retirement removes only workflow files from `infused-preview`. It does not change application source, the standalone `infused-show` production Worker, the Catalyst merchant-site Worker, custom domains, D1, Stripe, or customer data. The merged source branches still exist; their deletion is a separate operation because the connected GitHub action set does not expose branch deletion.

## Preserved acceptance receipts

| Sprint | Merged PR | Final successful workflow run |
|---|---|---|
| S02 isolated preview build/deploy | [PR #15](https://github.com/Catalyst-Media-Partners/catalyst-website/pull/15) | [Run 40579792958](https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/40579792958) |
| S03 navigation/water preview | [PR #16](https://github.com/Catalyst-Media-Partners/catalyst-website/pull/16) | [Run 40584836847](https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/40584836847) |
| S04 dimensional water/editorial preview | [PR #17](https://github.com/Catalyst-Media-Partners/catalyst-website/pull/17) | [Run 40591219683](https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/40591219683) |
| S05 market/Vegas evidence preview | [PR #18](https://github.com/Catalyst-Media-Partners/catalyst-website/pull/18) | [Run 40613715598](https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/40613715598) |
| S06–S10 full-site preview acceptance | [PR #19](https://github.com/Catalyst-Media-Partners/catalyst-website/pull/19) | [Run 40616665237](https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/40616665237) |

All listed final runs completed successfully. Earlier failed attempts remain in GitHub Actions history and are not deleted.

## Files retired from `infused-preview`

- `.github/workflows/deploy-dropjourney-s02.yml`
- `.github/workflows/deploy-dropjourney-s03.yml`
- `.github/workflows/deploy-dropjourney-s04.yml`
- `.github/workflows/deploy-dropjourney-s05.yml`
- `.github/workflows/deploy-dropjourney-s10.yml`

## Validation required

The cleanup PR must pass the existing `infused-preview` pull-request QA. After merge, verify the retained general preview workflow succeeds and that its isolated `infused-dropjourneytest` deployment is healthy. The `infused-show` production Worker must remain unchanged.

## Branch follow-up

The five sprint source branches are historical merged branches. Retire them after confirming the above receipts are retained and no active work depends on them. Branch deletion is not performed by this change.
