# Shared Hangman at /privategames

## Room and game rules

All visitors to `https://catalystmediapartners.com/privategames` (including www) share the same saved Hangman room. Display names are optional. Each word allows exactly 10 unique incorrect guesses. The board, clue, turn order, and cumulative wins/losses are shared.

Players act in entry order. Each valid new letter passes the turn whether correct or incorrect. Invalid, repeated, stale, and out-of-turn guesses consume no turn or strike. The current player's name appears inside the drawing and in the roster. Only that player can guess, voluntarily pass, or start the next word.

A player cycle is one pass through the roster, separate from a word round. New players can append before the first move of a cycle. Later arrivals wait until the cycle completes. A new word preserves that cycle and waiting list. Renaming and duplicate tabs do not create extra positions. Explicit Leave removes all tabs for that device after a successful save; Rejoin follows normal admission rules.

Explicitly enabling the clue makes each subsequent word's clue visible too. A clue automatically revealed at the end of a word does not itself enable future clues. Skipping a word, passing a turn, a majority vote, or a timer expiry never records a loss or adds a strike.

## Dictionary and new-game settings

The Worker bundles 62,368 playable WordNet entries with adapted definitions. No external dictionary call or API key is needed during play. Source downloads and hashes are pinned; complete licensing and rebuild details are in `docs/privategames-dictionary/`. The public source and attribution page is `/privategames/dictionary.html`.

| Vocabulary | Words | Meaning |
| --- | ---: | --- |
| Easy | 2,222 | Estimated common vocabulary |
| Middle school | 6,997 | Estimated moderate vocabulary plus the original 50 curated words |
| Advanced | 22,965 | Less-common vocabulary, including technical terms |
| Full dictionary | 62,368 | All eligible entries in the bundled corpus, including rare words |

Levels estimate familiarity from wordfreq; they are not certified grade lists. Entries must be alphabetic and 3–15 letters. Proper names, phrases, nonalphabetic forms, and selected unsuitable headwords/senses are filtered. The corpus has not been manually reviewed word by word for classroom use. The adapted data is CC BY-SA 4.0 with the complete original WordNet notice retained; this data license does not relicense the game code.

The current player chooses vocabulary, minimum/maximum length, and turn rule under New game settings. Changes apply only with the next word. The UI shows the matching word count and prevents empty selections; the server independently validates settings. Scores remain cumulative. A bounded history of 100 recent selections reduces repeats and relaxes the oldest exclusions when a small pool runs out. No full word pool is stored in a room record or shipped to the game client.

## Voting, clocks, and background players

Default mode is Group vote with a 90-second fallback. The current player can always pass voluntarily. A group skip requires at least two distinct eligible peers and a strict majority of those peers. The current player and waiting players cannot vote. Eligibility is captured when the first vote is cast; an eligible player's explicit departure or roster expiry clears the ballot, so an old minority never becomes an automatic pass.

With fewer than two eligible peers, or when the current player is offline, the turn uses a 90-second fallback. Timer mode instead uses the selected 60, 90, or 120 seconds. The server owns deadlines; the client countdown uses server time. A truly solo room has no clock. Waiting arrivals count toward the need for a clock, preventing an absent lone incumbent from blocking them indefinitely.

Non-subscribers keep their position during a 12-second reconnect grace. Players with enabled push subscriptions stay in the roster for up to 30 minutes offline, allowing the phone to sleep or switch apps. Their individual turn still has a bounded return window. All-offline rooms pause clocks and cancel obsolete turn alerts. Clocks also pause after 30 minutes without deliberate activity, even if a forgotten browser keeps a socket open. Joining or acting resumes activity. Expired roster membership does not delete the saved board.

## Phone notifications

Notifications are optional and require a device opt-in. Loading the page never requests permission or creates a browser push subscription.

- iPhone/iPad: open in Safari, use Share > Add to Home Screen, launch that icon, then Enable turn alerts and Allow. Requires a supported Home Screen web app (iOS/iPadOS16.4+).
- Android and supported desktop browsers: use Enable turn alerts and approve the browser prompt.
- Test alert sends only to the consenting player's registered device. Test requests are limited to once per minute.
- Turn alerts off removes the server registration and browser subscription. Browser permission remains under device settings.
- Focus, Do Not Disturb, browser restrictions, connectivity, and OS notification settings control actual presentation. Provider acceptance is not proof that a banner appeared.

The manifest and service worker are scoped to `/privategames/`. There is no fetch handler, offline board simulation, or game-response cache. Notifications reopen/focus the game, which retrieves current state. Short-lived jobs and a stable notification tag reduce stale alerts. A stale payload still displays a generic visible game update rather than claiming the turn remains current. Expired subscriptions offer an explicit retry that replaces the old endpoint.

Web Push uses Worker-native WebCrypto for RFC8291 aes128gcm payload encryption and RFC8292 ES256 VAPID. Keys are generated once and saved privately in the Durable Object; no email service, Firebase application credential, Worker secret setup, or App Store app is needed. A bounded private authorization cache avoids frequent Apple token refreshes. Production Apple, Google FCM, and Mozilla push endpoint hosts are validated; arbitrary URLs, redirects, invalid points, and malformed keys are rejected.

Browser storage contains an optional name, player UUID, a private random notification-owner secret, and local opt-in/leave preferences. Only the owner secret's SHA-256 hash is saved server-side. Public player IDs cannot alter another device's notification subscription. Subscriptions, keys, authorization cache, and outbox never appear in public snapshots. The room is still an unlisted anonymous game, not an authenticated account system.

Game state, private outbox changes, and the single durable alarm commit together before broadcast. Provider I/O runs outside the game queue, with an eight-second request timeout. Each job is claimed durably before sending, with at most three attempts and a short expiry. 404/410 remove only the matching failed subscription. A provider Retry-After longer than the turn's lifetime ends that job instead of retrying early. HTTP delivery is not exactly once across process loss; provider topics and notification tags coalesce retries.

## Deployment and persistence

Repository: `Catalyst-Media-Partners/catalyst-website`; production branch `main`; Worker `catalyst-website`. Preserve the existing owner-merged PR and exact-head passing validate gate. GitHub Actions is the sole production publisher.

Stable runtime identities:

- Worker entrypoint: `src/worker.js`; router: `src/route-handler.mjs`.
- Static assets: `privategames/`, copied exactly to `public/privategames/`.
- Durable binding/class: `HANGMAN_ROOMS` / `HangmanRoom`.
- Existing namespace migration: `privategames-v1` with `new_sqlite_classes = ["HangmanRoom"]`.
- Durable object identity: `catalyst-hangman-v1`.
- Game storage key: `hangman-state-v1`.
- Separate private push store, VAPID key, and authorization-cache keys are defined in the push modules.
- Read endpoint: `/privategames/api/state`; same-origin WebSocket: `/privategames/api/socket`.

Schema3 upgrades the latest saved schema1/2 record in place. It preserves the current word, guesses, score, sticky clue choice, legacy bag, and schema2 turn token/cursor/order. The expanded dictionary is used on the next word. Existing players refresh once to load the new interface. Do not rotate keys, change the room identity, delete the namespace, or reset storage as a deployment workaround.

Merchant homepage/assets, the separate INFUSED route, domain associations, and release gates remain under their existing policies. The route stays unlisted/noindex and does not add a homepage link. Anyone with the link can play. No email address, phone number, payment, or CRM data is collected.

## Verification and recovery

Run `npm run test:privategames` for gameplay/room integration, routing, independent cryptographic transport checks, dictionary integrity, and client/service-worker behavior. The source QA workflow also builds the exact site, checks merchant/INFUSED parity, and runs the pinned Wrangler dry run. Mobile UI QA uses isolated fixtures while real players are active. Real phone delivery requires explicit device permission and the Test alert action; mocks do not prove an OS banner appeared.

To take the game offline temporarily, return503 only for its route/API while preserving the class export, binding, migration and durable identity. Continue serving other assets normally. Roll forward with a repair that can read the current schema; older code that does not understand schema3 will correctly refuse to overwrite it. Do not roll back across the original Durable Object creation boundary.

Official references: [Web Push on iPhone](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [RFC8291](https://www.rfc-editor.org/rfc/rfc8291), [RFC8292](https://www.rfc-editor.org/rfc/rfc8292), [Durable alarms](https://developers.cloudflare.com/durable-objects/api/alarms/).
