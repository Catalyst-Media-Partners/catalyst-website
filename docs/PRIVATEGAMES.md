# Shared Hangman at /privategames

## Behavior

All visitors to `https://catalystmediapartners.com/privategames` (including the www hostname) join the same shared Hangman room. A display name is optional. The room uses the existing 50 middle-school vocabulary words, at most 15 letters, and exactly 10 unique incorrect guesses per loss. Everyone sees the same guesses, clue, outcome, and cumulative wins/losses.

The word, shuffled word bag, round identifier, guesses, and scores live in a SQLite-backed Cloudflare Durable Object. Each accepted move is saved before it is broadcast over WebSockets. Browser refreshes, reconnects, and ordinary code redeployments retain the room. Browser storage holds only an optional display name and device identifier; it is not the game database.

Every action carries its round ID. Concurrent guesses are serialized; a repeated letter cannot consume two strikes. Two players pressing Next for the same round can advance only once. Starting a new word during a round asks for confirmation in the interface when guesses have been made. A skipped round does not count as a loss.

The URL is unlisted and carries noindex headers. It is not password protected: anyone with the link can join and play. The route has no links from the business homepage. It stores no email, payment, CRM, or account data. Avoid entering sensitive information as a display name.

## Deployment

Source: `Catalyst-Media-Partners/catalyst-website`, production branch `main`, Worker `catalyst-website`.

The existing owner-merged PR and passing `validate` gate remain required. GitHub Actions is the only publisher. The PR runs rule, concurrency, persistence, routing, build-parity, and Wrangler dry-run checks. The post-deploy check verifies both the ASSETS and HANGMAN_ROOMS bindings. Merchant homepage and image files remain byte-for-byte governed by the existing checks; existing domain associations and the separate INFUSED preview route are unaffected.

Runtime additions:

- Entrypoint: `src/worker.js`.
- Static files: `privategames/`, copied to `public/privategames/`.
- Binding: `HANGMAN_ROOMS`, class `HangmanRoom`.
- Migration: `privategames-v1`, `new_sqlite_classes = ["HangmanRoom"]`.
- Durable object identity: `catalyst-hangman-v1`. Keep this name stable to retain the existing room.
- HTTP read endpoint: `/privategames/api/state`.
- Same-origin WebSocket endpoint: `/privategames/api/socket`.
- Worker-first routing applies only to `/privategames` and `/privategames/*`; other paths retain asset-first behavior.

## Acceptance

Open the URL on two devices. A guess on either must appear on both with the same strike count. Reload one device and confirm the round ID, guesses, and score remain. Verify a single shared hint, connection recovery, and Next round propagation. The server test suite covers the exact tenth-strike loss, repeated letters/guesses, stale rounds, shuffled word cycles, durable save ordering, and simultaneous actions.

## Recovery and rollback

The pre-change production revision is `f1fac5e4777b6b2e564e65ae78dab3531ff65649`; its Worker version is `4d98ed04-cf6f-41fc-be51-8d4f14127e57`. Adding the first Durable Object namespace is a migration boundary. Do not delete the namespace or blindly roll back across that boundary.

To temporarily take the game offline, deploy a scoped change returning HTTP 503 only for `/privategames` and its API while preserving the class export, binding, migration, and durable object name. Continue serving the existing homepage through ASSETS. Repair and redeploy the game normally to reconnect to its saved state. Never reset storage as a deployment workaround.

Official references: [asset routing](https://developers.cloudflare.com/workers/static-assets/binding/), [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-object-class-migrations-legacy/), [WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
