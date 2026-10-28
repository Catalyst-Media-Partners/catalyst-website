# INFUSED Drop Journey | Source checkpoint v1.5.0

This directory captures the **editable front-end sources of the live isolated Drop Journey prototype**, extracted from the deployed `infused-dropjourneytest` Cloudflare Worker on 2026-10-27.

## Authoritative split

- **GitHub:** Version-controlled editable source and QA changes. Production INFUSED source lives on this repository's `infused-show` branch. The `dj/s01-trusted-baseline-20261027` branch is isolated, reviewed in PR #14, and does **not** deploy production.
- **Cloudflare:** Actual live runtime/version/route evidence and preview Worker. The production Worker is `infused-show`; the redesign prototype Worker is `infused-dropjourneytest`. Do not deploy to or modify production as part of this source capture.
- The source zip or artifacts in other file stores are **not** authoritative and must not be used as release gates.

## Verified source provenance

The following files were reconstructed from Cloudflare's deployed v1.5.0 bundled HTML, then compared byte-for-byte through hashes against the previously tested local source copies:

| File | SHA-256 |
| --- | --- |
| `src/index.html` | `4e361a7d5b37349ab8967de1e68652058f25e64866829aee98e679f3d87468ab` |
| `src/styles.css` | `b387f65061a239b64dcfd0855681a66917a1e9f2ef7bf25d4b13dfccaa59460d` |
| `src/app.js` | `f0908d4dc465efd281660c793e75d262c32e101b15f3a518d314c9181353e9f9` |

Expected HTML template placeholders: `{{STYLES}}` and `{{SCRIPT}}`. The current Cloudflare Worker was built by embedding the CSS/JS into the HTML and serving it on `/dropjourneytest` and `/dropjourneytest/`; it delegates other paths to the existing origin.

Live reference: https://infused.show/dropjourneytest

Cloudflare test deployment: `24db0bfa-e369-43d0-b17f-9acb3e078cc7`, deployed 2026-10-27T18:30:10Z. Runtime version `1.5.0`.

## Source-level build follow-on

S02 should add the original dependency-free build/QA scripts and a namespaced multipage design system **within this directory**, preserving existing production source. Never treat generated `public/` as editable source. Before the next preview deployment, reproduce the current Worker output and compare layout, behavior, and protected routes.

This checkpoint is **not** a production release and makes no changes to Cloudflare routing, domain configuration, secrets, payments, forms, or the `infused-show` branch.
