// Server-only word selection. Never import this module into public assets.
import { PACKED_WORDS, DICTIONARY_VERSION, DICTIONARY_SHA256 } from './dictionary-data.mjs';
import { DICTIONARY_METADATA } from './dictionary-metadata.mjs';

export { DICTIONARY_VERSION, DICTIONARY_SHA256 };
export const DEFAULT_WORD_SETTINGS = Object.freeze({ vocabulary: 'middle', minLength: 3, maxLength: 15 });
export const VOCABULARIES = Object.freeze(['easy', 'middle', 'advanced', 'dictionary']);
const FLAGS = Object.freeze({ easy: 1, middle: 2, advanced: 4, dictionary: 8 });

// Compact source data reduces bundle size. Entries are allocated lazily on the
// first selection; aggregate counts need not parse the dictionary at all.
let entries;
const poolCache = new Map();
const MAX_CACHED_POOLS = 32;

function allEntries() {
  if (!entries) {
    entries = Object.freeze(PACKED_WORDS.split('\n').map(row => {
      const [word, flags, clue] = row.split('\t');
      return Object.freeze({ word, clue, flags: Number(flags) });
    }));
  }
  return entries;
}

function checkedSettings(input = DEFAULT_WORD_SETTINGS) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Word settings must be an object.');
  }
  const vocabulary = input.vocabulary === undefined ? DEFAULT_WORD_SETTINGS.vocabulary : input.vocabulary;
  const minLength = input.minLength === undefined ? DEFAULT_WORD_SETTINGS.minLength : input.minLength;
  const maxLength = input.maxLength === undefined ? DEFAULT_WORD_SETTINGS.maxLength : input.maxLength;
  if (!VOCABULARIES.includes(vocabulary)) throw new RangeError('Choose a supported vocabulary level.');
  if (!Number.isInteger(minLength) || !Number.isInteger(maxLength) || minLength < 3 || maxLength > 15 || minLength > maxLength) {
    throw new RangeError('Word lengths must be integers from 3 to 15, with minimum no greater than maximum.');
  }
  return { vocabulary, minLength, maxLength };
}

function countChecked(settings) {
  const level = DICTIONARY_METADATA.levels.find(candidate => candidate.id === settings.vocabulary);
  let count = 0;
  for (let length = settings.minLength; length <= settings.maxLength; length++) {
    count += level.countsByLength[String(length)] || 0;
  }
  return count;
}

/** Strict validation; invalid or empty ranges never silently widen. */
export function normalizeWordSettings(input = DEFAULT_WORD_SETTINGS) {
  const settings = checkedSettings(input);
  if (countChecked(settings) === 0) throw new RangeError('No dictionary words match that vocabulary and length range.');
  return Object.freeze(settings);
}

/** Valid empty ranges return zero, allowing clients to disable them in advance. */
export function countWords(input = DEFAULT_WORD_SETTINGS) {
  return countChecked(checkedSettings(input));
}

/** Returns immutable entries. Keep the pool server-side, never in room storage. */
export function getWordPool(input = DEFAULT_WORD_SETTINGS) {
  const settings = normalizeWordSettings(input);
  const key = `${settings.vocabulary}:${settings.minLength}:${settings.maxLength}`;
  if (poolCache.has(key)) {
    const cached = poolCache.get(key);
    poolCache.delete(key);
    poolCache.set(key, cached);
    return cached;
  }
  const flag = FLAGS[settings.vocabulary];
  const pool = Object.freeze(allEntries().filter(entry =>
    (entry.flags & flag) && entry.word.length >= settings.minLength && entry.word.length <= settings.maxLength));
  if (poolCache.size >= MAX_CACHED_POOLS) poolCache.delete(poolCache.keys().next().value);
  poolCache.set(key, pool);
  return pool;
}

/** Aggregate metadata is safe to send to clients; it contains no headwords. */
export function getVocabularyMetadata() {
  return structuredClone(DICTIONARY_METADATA);
}

/**
 * Exclusions are chronological, oldest first. Usually only the latest 100 words
 * need persistence. If a small pool is exhausted, relax the oldest exclusions;
 * the immediate predecessor remains excluded whenever another candidate exists.
 */
export function pickWord(input = DEFAULT_WORD_SETTINGS, { random = Math.random, excludeWords = [] } = {}) {
  const pool = getWordPool(input);
  if (typeof random !== 'function') throw new TypeError('random must be a function.');
  if (!Array.isArray(excludeWords)) throw new TypeError('excludeWords must be an array ordered oldest to newest.');
  const history = excludeWords.filter(word => typeof word === 'string').map(word => word.toLowerCase());
  const blocked = new Set(history);
  let available = pool.filter(entry => !blocked.has(entry.word));
  if (!available.length) {
    // Preserve the most recent occurrence when history contains duplicates.
    const lastSeen = new Map(history.map((word, index) => [word, index]));
    let oldest = Infinity;
    for (const entry of pool) oldest = Math.min(oldest, lastSeen.get(entry.word) ?? -1);
    available = pool.filter(entry => (lastSeen.get(entry.word) ?? -1) === oldest);
  }
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError('random must return a number in [0, 1).');
  const selected = available[Math.floor(value * available.length)];
  // Do not return the internal membership flags to application state.
  return Object.freeze({ word: selected.word, clue: selected.clue });
}
