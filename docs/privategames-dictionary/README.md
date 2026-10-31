# Hangman dictionary

The dictionary is bundled in the Worker and never fetched per word. Answers,
definitions, and membership flags remain server-side. Public metadata contains
only aggregate counts, tier descriptions, source names, and attribution.

## Sources and licensing

- Princeton WordNet 3.0 database: <https://wordnet.princeton.edu/>.
  Original terms: <https://wordnet.princeton.edu/license-and-commercial-use>.
- wordfreq 3.2, by Robyn Speer, pinned to commit
  `42233e6c36ce792031bcccfa17cdd0cec9af5fa7`:
  <https://github.com/rspeer/wordfreq>. English frequency estimates are based on
  the project's historical corpus snapshot, not a live measure of language use.
- All upstream downloads, SHA-256 hashes, output sizes and corpus counts are
  recorded in `manifest.json`. Complete required notices are in `NOTICES.txt`
  and retained inside every generated data module's license comment.
- The adapted dictionary data is offered under CC BY-SA 4.0 with the original
  WordNet notice preserved. This data license does not relicense the game code.

## Meaning of the vocabulary levels

These are estimated familiarity bands, not certified school reading grades.
Frequency does not measure every aspect of vocabulary difficulty.

| Level | Selection rule |
| --- | --- |
| Easy | wordfreq Zipf frequency at least 4.5 |
| Middle school | Zipf 3.5–4.49, plus all 50 original curated words and clues |
| Advanced | Zipf 2.0–3.49 |
| Full dictionary | All eligible WordNet entries, including words below those frequency bands |

Original curated words can overlap the Easy/Advanced bands. The full pool is
all **playable entries in this bundled corpus**, not every English spelling in
existence. It includes rare and technical words. It excludes names, phrases,
hyphenated forms, non-ASCII letters, entries outside 3–15 letters, and filtered
headwords/senses. An explicit family-game filter removes common profanity,
slurs and sexual-content senses; this is not a claim of comprehensive manual
or classroom review. Ordinary medical and scientific vocabulary is retained.

Definitions are adapted from a recorded WordNet sense. Examples are removed,
answer occurrences are replaced by blanks, and longer definitions are capped
at 235 characters. The original 50 hand-written game clues remain unchanged.

## Rebuild and validate

The build script requires Python 3.10+, Node.js, and Python `msgpack`. No Python
or third-party runtime package is required in the deployed Worker.

```sh
python3 scripts/build-privategames-dictionary.py --download
node tests/privategames-dictionary.mjs
```

Downloads default to `/tmp/hangman-dictionary-sources`; use `--source-dir PATH`
to select another cache. Every input is checked against its pinned SHA-256
before any output is written. A rebuild using the same inputs is deterministic.
The original source archives do not need to be committed to the application.

The generated corpus is split into source modules under
`src/privategames/dictionary-parts/`, each no larger than 180,000 UTF-8 bytes.
`dictionary-data.mjs` statically imports those parts and joins them with a
newline. This avoids large individual source-upload payloads while preserving
the exact packed corpus, exports, and lookup behavior. There is no runtime
decompression or network loading. `manifest.json` records the wrapper hash,
each part's hash/byte size/record count, and aggregate source sizes. The metadata
module and all public vocabulary counts remain unchanged.

## Server API

Import from `src/privategames/dictionary.mjs`:

- `normalizeWordSettings({ vocabulary, minLength, maxLength })` validates
  settings, rejecting invalid or empty ranges. Defaults are Middle school,
  3–15 letters. It never coerces or widens a request.
- `countWords(settings)` returns a count, including zero for a valid empty
  combination. Invalid bounds or vocabulary identifiers still throw.
- `getWordPool(settings)` returns an immutable server-only pool; do not put it
  in client responses or persistent room records.
- `pickWord(settings, { random, excludeWords })` selects from the eligible pool.
  `excludeWords` is ordered oldest to newest. If the pool is exhausted, only
  the oldest exclusion is relaxed. The immediate predecessor cannot repeat
  when there is another eligible word. Persist only a bounded recent history.
- `getVocabularyMetadata()` returns a defensive copy of aggregate metadata
  matching the UI contract, with per-tier counts for every length from 3–15.

The original `words.mjs` remains unchanged for stored-game migration. New
settings take effect only when the game backend starts the next round.
