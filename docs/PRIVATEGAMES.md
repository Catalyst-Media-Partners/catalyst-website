# Shared Hangman at /privategames

## Behavior

All visitors to `https://catalystmediapartners.com/privategames` (including the www hostname) join the same shared Hangman room. A display name is optional. The room uses the existing 50 middle-school vocabulary words, at most 15 letters, and exactly 10 unique incorrect guesses per loss. Everyone sees the same guesses, clue, outcome, and cumulative wins/losses.

Players take turns in entry order. Each valid, previously unguessed letter passes the turn, whether correct or incorrect. The current player's name is highlighted inside the hangman drawing and in the player list. Only that player can guess or start/skip to another word. Invalid or repeated letters do not consume a turn.

A player cycle is one pass through the current roster, separate from a word round. Arrivals before the first move of a cycle append in entry order. Once the cycle has started, newcomers wait until the last player has taken a turn, then enter the next cycle. Starting another word preserves the player cycle and cursor; it does not admit waiting players early or consume the current player's letter turn.

Once an active roster member enables the clue, clues remain visible for everyone across subsequent words. The new word displays its own clue. Merely revealing a finished word does not enable clues for future words.

The word, shuffled word bag, round identifier, guesses, scores, clue preference, and turn schedule live in a SQLite-backed Cloudflare Durable Object. Each accepted change is saved before it is broadcast over WebSockets. Browser refreshes and ordinary code redeployments retain the game. Browser storage holds only an optional display name and device identifier; it is not the game database. Duplicate tabs on the same device share one player position, and renaming does not change entry order.

Disconnected players keep their place for 12 seconds to allow a refresh or short reconnect. After that, a durable alarm removes them so an absent player cannot block the room. A later return joins according to the normal admission rules. The current word and scores remain saved even when everyone leaves.

Every action carries its round ID; guesses and Next also carry the current turn token. The server serializes changes and rejects out-of-turn, queued, or stale moves. A repeated letter cannot consume two strikes, and simultaneous Next actions can advance only once. Starting a new word during a round asks for confirmation in the interface when guesses have been made. A skipped round does not count as a loss.

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

Open the URL on two devices and confirm entry order. The highlighted player can make one guess; the other device's keys remain disabled until its turn. Add a third device after the first move and confirm it waits until the current player cycle ends. All devices must show the same guesses, turn, and strike count. Reload within the 12-second reconnect window and confirm the position, round, guesses, and score remain. Verify a shared clue stays visible with the next word, and that a new word started mid-cycle does not admit waiting players early. Verify a disconnected player is removed after the grace interval.

The server tests cover turn admission and advancement, stale turn tokens, duplicate tabs, disconnect recovery and alarms, late-player promotion, sticky clues, schema migration, the exact tenth-strike loss, repeated letters, shuffled word cycles, durable save ordering, and simultaneous actions. Use isolated fixtures or test rooms for gameplay checks when people are playing in production.

The turn-order release upgrades stored schema 1 to schema 2 in place under `hangman-state-v1`. It reads the latest saved record at runtime and preserves the current word, guesses, bag, and score. Existing connected sockets seed the first roster in their available connection order because the previous version did not store entry history. Existing players must refresh once to load the new client; older clients receive an explicit refresh notice when attempting a move.

## Recovery and rollback

The pre-change production revision is `f1fac5e4777b6b2e564e65ae78dab3531ff65649`; its Worker version is `4d98ed04-cf6f-41fc-be51-8d4f14127e57`. Adding the first Durable Object namespace is a migration boundary. Do not delete the namespace or blindly roll back across that boundary.

To temporarily take the game offline, deploy a scoped change returning HTTP 503 only for `/privategames` and its API while preserving the class export, binding, migration, and durable object name. Continue serving the existing homepage through ASSETS. Repair and redeploy the game normally to reconnect to its saved state. Never reset storage as a deployment workaround.

Official references: [asset routing](https://developers.cloudflare.com/workers/static-assets/binding/), [Durable Object migrations](https://developers.cloudflare.com/durable-objects/reference/durable-object-class-migrations-legacy/), [WebSocket hibernation](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).
