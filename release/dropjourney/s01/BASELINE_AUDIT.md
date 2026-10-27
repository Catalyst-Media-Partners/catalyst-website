# DJ-S01 | GitHub + Cloudflare authoritative baseline

Captured: 2026-10-27
Status: TECHNICAL BASELINE VERIFIED. Editorial and full-route acceptance evidence continue under the applicable sprint gates.
Source-of-truth correction: GitHub and Cloudflare are the ONLY official development and deployment sources. Historical copies in other services are not part of S01, version control, or release acceptance.

## Authoritative sources

| Concern | Authoritative record |
|---|---|
| Production code | GitHub repository `Catalyst-Media-Partners/catalyst-website`, branch `infused-show`, commit `891e895913b6432162b4aa27fd49df6cc918fdbe`, source tree `55812022bde6ff982ea97104f2dd22c415b2ec04` |
| Production CI | https://github.com/Catalyst-Media-Partners/catalyst-website/actions/runs/39854333926, successful at the exact production commit |
| Production deployment | Cloudflare Worker `infused-show`, version `f69bd0ee-3ad0-4bbb-8bc9-d756a70bfb2a`, deployment `c79682ae-15cf-420e-88d9-6dc7e8a6558e`, 100% since 2026-10-22T21:05:29Z |
| Redesign development | GitHub branch `dj/s01-trusted-baseline-20261027`, based on the exact production commit, with review in PR #14 |
| Water-motion visual baseline | Cloudflare Worker `infused-dropjourneytest`, current tested v1.5, deployment `24db0bfa-e369-43d0-b17f-9acb3e078cc7` |
| Preview URL | https://infused.show/dropjourneytest |
| Preview route | Cloudflare zone pattern `infused.show/dropjourneytest*`, attached only to `infused-dropjourneytest` |

**Git commit SHA is the rollback/source reference.** A separate manually archived source ZIP is not necessary, nor is an archive in another service a sprint acceptance criterion. Deployed Worker version and deployment IDs provide the runtime rollback reference. The GitHub SHA and matching successful CI establish the code baseline; the standalone prototype Worker must also be represented as GitHub-controlled source before further design deployment.

## Production routes and parity boundary

Existing public pages (15):
`/`, `/market/`, `/ecosystem/`, `/roots/`, `/science/`, `/make/`, `/package/`, `/move/`, `/sell/`, `/services/`, `/buyers/`, `/why-vegas/`, `/opportunities/`, `/contact/`, `/tickets/`.

Their intended new routes are rooted under `/dropjourneytest/`, with the homepage at `/dropjourneytest/`. The optional guided-buyer route is `/dropjourneytest/buyers/apply/`, not an approved live submission endpoint.

- GitHub source at production SHA is authoritative for templates, media and precise wording. Reuse current source; do not reconstruct production from earlier ZIPs.
- Cloudflare Browser Rendering captured a 15-route read-only snapshot in `2026-10-27-live-page-snapshots.json`. Its text excerpts are **truncated by the provider** and are supplementary evidence only, not full-document copies or content-parity hashes.
- Full rendered route and interaction parity should be tested from GitHub-built output against the live production site as pages are migrated. Do not create a trusted QA baseline from modified redesign code.

## Facts and unresolved editorial gates

Do not invent or silently change commercial or event facts.

1. The production site/GitHub release states **May 13–14, 2027** at Las Vegas Convention Center. Current public wording can be carried forward unchanged; substantive changes require current operator approval.
2. Production advertises inline 10x10 booths starting at **$3,000** and 10x10 corners at **$3,500**. Preserve only current approved display and verification at the actual Map Dynamics purchase destination.
3. Production ticket page contains a **25% early-bird offer**; notification submission is intentionally disabled until SES, Turnstile, D1 migration, sender/consent and offer activation are truly ready. Do not imply working submissions.
4. Hosted-buyer qualification is a **non-submitting prototype** until an approved form endpoint, verification/consent and retention mapping are available.
5. Existing market claims require source-year/geographic qualifiers and valid citations; do not create new unsourced numbers.
6. Confirm license/approval and authentic-event attribution for imagery before using it as event documentary photography.

These are editorial/activation decisions to track against the relevant content and conversion sprints. They do not prevent freezing the verified GitHub+Cloudflare technical baseline.

## Protected runtime/integration boundaries

- `infused-show` owns the primary production hostnames `infused.show` and `www.infused.show`; bindings `ASSETS` and `AUDIENCE_DB`. Do not touch production Worker code, deployment, DNS, or secrets during the redesign.
- Preserve production first-party `/go/booth` attribution and original Map Dynamics purchase URL, checkout state, pricing/discount workflow and privacy boundaries. Do not recreate this handler in the preview Worker.
- Preserve production ticket verification/unsubscribe endpoints and disabled state until authorized activation.
- Preview content remains `noindex, nofollow, noarchive` at both HTTP and HTML levels; exclude all preview pages from the sitemap; use no customer data or outbound dispatch.
- Existing wildcard preview route may also match suffixes such as `/dropjourneytestanything`; preview Worker must delegate/fail-closed on unexpected suffixes. Harden routing and test deep links in DJ-S03 without altering production domains.
- Preview rollback changes only `infused-dropjourneytest`. Do not roll back `infused-show` when reversing a prototype sprint.

## S01 acceptance register

| Story | Result | Evidence / follow-on |
|---|---|---|
| DJ-S01-01: Production source and CI provenance | **PASS** | Exact GitHub SHA + successful GitHub Actions run + matching Cloudflare deployment, no external archive required |
| DJ-S01-02: Full site route and content inventory | **PARTIAL** | 15/15 public routes and current source tree captured; browser excerpts are truncated; full page/media parity to be checked as routes migrate |
| DJ-S01-03: Public facts / dependencies | **PARTIAL** | Claim status and protected submission states recorded; confirmation and activation decisions follow applicable page and commercial sprints |
| DJ-S01-04: Safe preview / rollback boundaries | **PASS for boundary inventory** | Isolated Worker, distinct route and deployed version verified; end-to-end rollback simulation belongs to DJ-S10 |

No commit to production `infused-show`. No Cloudflare, DNS, commerce, D1, email, or live page edits occurred in DJ-S01.

## Next execution

1. Keep S01 evidence in GitHub and track open decisions in GitHub issues/PRs, not elsewhere.
2. Capture the v1.5 creative prototype in **GitHub** as a source-level reference; its deployed Cloudflare Worker is not itself adequate version control.
3. DJ-S02 derives the visual system from the locked current production commit and the existing v1.5 prototype, without redesign-driven changes to primary site routes.
4. DJ-S03 builds namespaced multipage routes and cross-page navigation. Ensure CI builds and tests the exact preview output before Cloudflare test Worker deployment.
