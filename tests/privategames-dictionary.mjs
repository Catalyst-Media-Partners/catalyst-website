import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import {
  DEFAULT_WORD_SETTINGS, DICTIONARY_SHA256, DICTIONARY_VERSION,
  normalizeWordSettings, countWords, getWordPool, getVocabularyMetadata, pickWord,
} from '../src/privategames/dictionary.mjs';
import { PACKED_WORDS } from '../src/privategames/dictionary-data.mjs';
import { WORD_BANK } from '../src/privategames/words.mjs';

let passed = 0;
function test(name, action) {
  action();
  passed++;
  console.log(`PASS ${name}`);
}
const fullSettings = { vocabulary: 'dictionary', minLength: 3, maxLength: 15 };
const all = getWordPool(fullSettings);
const metadata = getVocabularyMetadata();

test('large dictionary contains unique alphabetic words and usable answer-safe clues', () => {
  assert.ok(all.length > 50000, 'the broad pool must be a real dictionary, not a small hand list');
  assert.equal(new Set(all.map(entry => entry.word)).size, all.length);
  for (const { word, clue } of all) {
    assert.match(word, /^[a-z]{3,15}$/);
    assert.ok(clue.length >= 8 && clue.length <= 235, word);
    assert.equal(new RegExp(`\\b${word}\\b`, 'i').test(clue), false, `answer disclosed: ${word}`);
  }
});

test('known ordinary and technical words exist; proper names and explicit headwords do not', () => {
  const words = new Set(all.map(entry => entry.word));
  for (const word of ['apple', 'computer', 'book', 'abacus', 'aardvark', 'zygote', 'photosynthesis', 'characteristics']) {
    assert.ok(words.has(word), word);
  }
  for (const word of ['london', 'einstein', 'washington', 'paris', 'france', 'america', 'fuck', 'shit', 'bitch', 'dickhead', 'bollocks', 'pornography', 'masturbation']) {
    assert.equal(words.has(word), false, word);
  }
});

test('original curated words and clues remain available in default Middle school pool', () => {
  assert.deepEqual(normalizeWordSettings(), DEFAULT_WORD_SETTINGS);
  const middle = new Map(getWordPool().map(entry => [entry.word, entry.clue]));
  for (const entry of WORD_BANK) assert.equal(middle.get(entry.word), entry.clue, entry.word);
});

test('all public aggregate counts match actual pools and exact 3–15 length filters', () => {
  assert.equal(metadata.total, all.length);
  assert.equal(metadata.estimatedDifficulty, true);
  assert.equal(metadata.version, DICTIONARY_VERSION);
  for (const level of metadata.levels) {
    assert.equal(countWords({ ...fullSettings, vocabulary: level.id }), level.count);
    let total = 0;
    for (let length = 3; length <= 15; length++) {
      const settings = { vocabulary: level.id, minLength: length, maxLength: length };
      const expected = level.countsByLength[String(length)];
      assert.equal(countWords(settings), expected);
      if (expected === 0) assert.throws(() => getWordPool(settings), RangeError);
      else {
        const pool = getWordPool(settings);
        assert.equal(pool.length, expected);
        assert.ok(pool.every(entry => entry.word.length === length));
      }
      total += expected;
    }
    assert.equal(total, level.count);
  }
});

test('invalid settings are rejected rather than silently widened or coerced', () => {
  for (const settings of [
    null, [], 'middle', { vocabulary: 'unknown' }, { vocabulary: null },
    { minLength: 2 }, { maxLength: 16 }, { minLength: 9, maxLength: 8 },
    { minLength: '3' }, { maxLength: 7.5 }, { minLength: NaN }, { maxLength: Infinity },
  ]) assert.throws(() => normalizeWordSettings(settings), settings === null || Array.isArray(settings) || typeof settings !== 'object' ? TypeError : RangeError);
  assert.equal(countWords({ vocabulary: 'easy', minLength: 15, maxLength: 15 }), 0);
  assert.throws(() => normalizeWordSettings({ vocabulary: 'easy', minLength: 15, maxLength: 15 }), RangeError);
});

test('selection covers both endpoints of a filtered pool and exposes only word and clue', () => {
  const settings = { vocabulary: 'dictionary', minLength: 15, maxLength: 15 };
  const pool = getWordPool(settings);
  assert.equal(pickWord(settings, { random: () => 0 }).word, pool[0].word);
  assert.equal(pickWord(settings, { random: () => 1 - Number.EPSILON }).word, pool.at(-1).word);
  assert.deepEqual(Object.keys(pickWord(settings)).sort(), ['clue', 'word']);
  for (const value of [-1, 1, NaN, Infinity]) assert.throws(() => pickWord(settings, { random: () => value }), RangeError);
});

test('recent words are excluded even with a fixed random source', () => {
  const settings = { vocabulary: 'middle', minLength: 15, maxLength: 15 };
  const pool = getWordPool(settings);
  const recent = [];
  for (let i = 0; i < pool.length; i++) {
    const next = pickWord(settings, { random: () => 0, excludeWords: recent });
    assert.equal(recent.includes(next.word), false);
    recent.push(next.word);
  }
  assert.equal(new Set(recent).size, pool.length);
  assert.equal(pickWord(settings, { random: () => 0, excludeWords: recent }).word, recent[0]);
  assert.notEqual(pickWord(settings, { random: () => 0.999, excludeWords: recent }).word, recent.at(-1));
});

test('exhausted histories relax oldest occurrences and tolerate uppercase/stale words', () => {
  const settings = { vocabulary: 'middle', minLength: 15, maxLength: 15 };
  const words = getWordPool(settings).map(entry => entry.word);
  const history = [...words, words[0]];
  assert.equal(pickWord(settings, { random: () => 0, excludeWords: history }).word, words[1]);
  assert.notEqual(pickWord(settings, { random: () => 0, excludeWords: ['obsolete-not-a-word', words[0].toUpperCase()] }).word, words[0]);
});

test('public metadata contains no headword pool, guesses, answers or clues', () => {
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      assert.ok(!['words', 'word', 'answer', 'clue', 'guesses', 'pool'].includes(key), key);
      visit(child);
    }
  };
  visit(metadata);
  metadata.levels[0].count = -1;
  assert.ok(getVocabularyMetadata().levels[0].count > 0, 'external metadata mutation must not corrupt the server');
  assert.ok(Object.isFrozen(all));
  assert.ok(Object.isFrozen(all[0]));
});

test('corpus hash, manifest, compressed budget and attribution notices match', () => {
  const manifest = JSON.parse(readFileSync(new URL('../docs/privategames-dictionary/manifest.json', import.meta.url), 'utf8'));
  const source = readFileSync(new URL('../src/privategames/dictionary-data.mjs', import.meta.url));
  const hash = createHash('sha256').update(PACKED_WORDS).digest('hex');
  assert.equal(hash, DICTIONARY_SHA256);
  assert.equal(hash, manifest.packedSha256);
  assert.equal(hash, '4fd6bd0469138e55472b9cac9ed84c5e5f304b5c1c027816b5833a3054ba07a1', 'release packaging must preserve the accepted corpus byte-for-byte');
  assert.equal(all.length, 62368);
  assert.equal(createHash('sha256').update(source).digest('hex'), manifest.moduleSha256);
  assert.equal(source.length, manifest.moduleBytes);
  assert.equal(manifest.packaging, 'split-esm-v1');
  assert.equal(manifest.parts.length, manifest.partCount);
  assert.ok(manifest.partCount > 10);
  const parts = manifest.parts.map(part => {
    assert.match(part.file, /^src\/privategames\/dictionary-parts\/part-\d{3}\.mjs$/);
    const bytes = readFileSync(new URL(`../${part.file}`, import.meta.url));
    assert.equal(bytes.length, part.bytes);
    assert.ok(bytes.length <= 180000, part.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), part.sha256, part.file);
    assert.match(bytes.toString('utf8'), /WordNet 3\.0 Copyright 2006 by Princeton University/);
    return bytes;
  });
  assert.equal(manifest.parts.reduce((sum, part) => sum + part.records, 0), all.length);
  const combined = Buffer.concat([source, ...parts]);
  assert.equal(combined.length, manifest.totalSourceBytes);
  assert.ok(gzipSync(combined, { level: 9 }).length < 2 * 1024 * 1024, 'dictionary leaves headroom below 3MiB compressed Worker limit');
  const notice = readFileSync(new URL('../docs/privategames-dictionary/NOTICES.txt', import.meta.url), 'utf8');
  assert.match(notice, /WordNet 3\.0 Copyright 2006 by Princeton University/);
  assert.match(notice, /Robyn Speer/);
  assert.match(notice, /creativecommons\.org\/licenses\/by-sa\/4\.0/);
  assert.match(notice, /SUBTLEX/);
});

console.log(`${passed} dictionary tests passed; ${all.length.toLocaleString('en-US')} playable entries.`);
