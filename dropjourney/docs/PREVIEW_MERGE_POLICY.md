# INFUSED preview integration and merge policy

**Effective:** 2026-10-28. **Production:** `infused-show` is separate from `infused-preview`.

## Canonical branches
- **Production:** `infused-show` — its existing GitHub push workflow deploys the public `infused-show` Cloudflare Worker; **never merge preview changes here** without separate explicit production cutover authorization and operational clearance.
- **Accepted preview:** `infused-preview` — canonical source of the isolated 16-page `https://infused.show/dropjourneytest/` alternate site. GitHub push workflow validates and deploys **only** `infused-dropjourneytest`, then independently checks the production Worker deployment did not change.
- **Change branches:** short-lived feature branches created **from** `infused-preview` and targeting `infused-preview`. No stacking dependent pull requests on top of unmerged PR heads. Existing historical sprint branches are merged and should not be active development bases.

## Acceptance and merge
1. Begin a user-visible sprint with objective, likely changes, entry/exit gates.
2. Open at most one active feature PR at a time, except independently reviewable work that is not dependent and has explicit acceptance scope.
3. The `validate-preview-pr` GitHub Actions job builds baseline production source, checks static Worker isolation, builds the alternate site and runs all S03-S10, U0-U3 and brand-regression checks **without secrets and without any deployment**.
4. **Do not merge** if this required pre-merge job is failing, skipped without explanation, or pending; check the exact current PR head SHA and unresolved review threads. Resolve failures and retest before merge.
5. With passing checks and required scoped UX acceptance, merge the PR into `infused-preview` the same sprint. Confirm PR closed/merged; no stack of open predecessors.
6. On push into `infused-preview`, the `validate-and-publish-preview` workflow uses the isolated Cloudflare Worker and compares the production Worker deployment identifier before and after. If failing, stop subsequent work and correct/revert.
7. Confirm actual `infused-preview` deployed version, visible links/interactions and no production changes; publish succinct sprint closeout and next objective.
8. Operational approval gates (ticket/Hosted Buyer Jotform CAPTCHA and notifications, commercial terms, privacy, user acceptance, production checkout) remain **separate from merging source to preview**. Do not reclassify them as passing simply because CI is green.

## 2026-10-28 queue consolidation
- Seven stacked source PRs **#14, #15, #16, #17, #18, #19, #20** merged in dependency order into `infused-preview` (no production branch merge).
- Latest approved preview source: PR #20, head `60f84dece1038639613c226841ec63595da2bd80`, integration merge `4298a67b66fc5548bdaa9dba093991706e8f38bd`.
- All seven exact-source-head GitHub Actions workflows successful. Integration workflow https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/40752926791 also passed after merging.
- Production Worker `infused-show` remained deployment `c79682ae-15cf-420e-88d9-6dc7e8a6558e` during consolidation; check again after every future push.
- Historical merged sprint branches may remain in GitHub as archival refs; they are **not open release queues**. Optional branch deletion can occur separately with appropriate ref-delete access.
