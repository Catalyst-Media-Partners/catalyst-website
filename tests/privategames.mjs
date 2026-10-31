import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, assertStoredGame, createGame, publicState, WORD_BANK } from '../src/privategames/game.mjs';
import { HangmanRoom, STORAGE_KEY } from '../src/privategames/room.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const clone = value => structuredClone(value);
function fixture(word = 'parallel') {
  const game = createGame({ now: 1000 });
  const entry = WORD_BANK.find(entry => entry.word === word);
  return { ...game, word, clue: entry.clue, bag: WORD_BANK.map(entry => entry.word).filter(value => value !== word) };
}
const action = (game, type, extra = {}) => ({ type, roundId: game.roundId, ...extra });
const guess = (game, letter) => applyAction(game, action(game, 'guess', { letter }), { player: 'Alex', now: 2000 });

test('vocabulary stays alphabetic, unique, middle-school sized, with 15-letter support', () => {
  assert.equal(WORD_BANK.length, 50);
  assert.equal(new Set(WORD_BANK.map(entry => entry.word)).size, 50);
  assert(WORD_BANK.every(entry => /^[a-z]{1,15}$/.test(entry.word)));
  assert.equal(Math.max(...WORD_BANK.map(entry => entry.word.length)), 15);
});

test('a correct guess reveals every occurrence, duplicates cost nothing, and the hidden answer stays server-side', () => {
  const initial = fixture();
  const first = guess(initial, 'l');
  assert.equal(first.state.strikes, 0);
  assert.deepEqual(publicState(first.state).mask, [null, null, null, null, 'L', 'L', null, 'L']);
  assert.equal(first.state.guesses[0].player, 'Alex');
  const repeated = guess(first.state, 'L');
  assert.equal(repeated.changed, false);
  assert.equal(repeated.state.revision, first.state.revision);
  const before = publicState(initial);
  assert.equal(before.answer, null);
  assert.equal(before.clue, null);
  assert.equal('word' in before, false);
  assert.equal('bag' in before, false);
  assert(!JSON.stringify(before).toLowerCase().includes(initial.word));
  assert.deepEqual(initial.guesses, [], 'transition does not mutate the accepted state');
});

test('the ninth incorrect unique letter is playable and the tenth loses exactly once', () => {
  let game = fixture();
  const wrong = [...ALPHABET].filter(letter => !game.word.toUpperCase().includes(letter));
  for (const letter of wrong.slice(0, 9)) game = guess(game, letter).state;
  assert.equal(game.status, 'playing');
  assert.equal(game.strikes, 9);
  assert.equal(game.losses, 0);
  const duplicate = guess(game, wrong[0]);
  assert.equal(duplicate.changed, false);
  assert.equal(duplicate.state.strikes, 9);
  game = guess(game, wrong[9]).state;
  assert.equal(game.status, 'lost');
  assert.equal(game.strikes, 10);
  assert.equal(game.losses, 1);
  assert.equal(publicState(game).answer, 'PARALLEL');
  assert.equal(publicState(game).mask.join(''), 'PARALLEL');
  const afterLoss = guess(game, 'P');
  assert.equal(afterLoss.changed, false);
  assert.equal(afterLoss.state.losses, 1);
  assert.equal(afterLoss.state.strikes, 10);
});

test('solving the word records one win and prevents further guesses', () => {
  let game = fixture();
  for (const letter of new Set(game.word.toUpperCase())) game = guess(game, letter).state;
  assert.equal(game.status, 'won');
  assert.equal(game.wins, 1);
  assert.equal(game.losses, 0);
  assert.equal(game.strikes, 0);
  assert.equal(game.clueShown, true);
  assert.equal(guess(game, 'Z').changed, false);
  assert.equal(guess(game, 'Z').state.wins, 1);
});

test('shared hints persist, malformed input is rejected, and an active round needs explicit skip', () => {
  const game = fixture();
  for (const letter of ['', 'AB', '1', 'é', null, {}, ' A']) {
    assert.equal(guess(game, letter).changed, false);
  }
  const hinted = applyAction(game, action(game, 'hint')).state;
  assert.equal(publicState(hinted).clue, game.clue);
  assert.equal(hinted.strikes, 0);
  assert.equal(applyAction(hinted, action(hinted, 'hint')).changed, false);
  assert.equal(applyAction(game, action(game, 'next')).code, 'round_in_progress');
  assert.equal(applyAction(game, action(game, 'next', { skip: 'true' })).changed, false);
});

test('a stale guess or simultaneous Next from an old round cannot change the new word', () => {
  const game = fixture();
  const next = applyAction(game, action(game, 'next', { skip: true }), {
    now: 3000, makeRoundId: () => 'next-round',
  }).state;
  assert.equal(next.roundNumber, game.roundNumber + 1);
  assert.notEqual(next.word, game.word);
  assert.equal(next.strikes, 0);
  assert.deepEqual(next.guesses, []);
  assert.equal(next.clueShown, false);
  assert.equal(applyAction(next, action(game, 'next', { skip: true })).code, 'stale_round');
  assert.equal(applyAction(next, action(game, 'guess', { letter: 'A' })).changed, false);
  assert.equal(next.roundId, 'next-round');
});

test('serialized state restores the exact current game, score and shuffle order', () => {
  let game = fixture();
  game = guess(game, 'A').state;
  game = guess(game, 'Z').state;
  game = applyAction(game, action(game, 'hint')).state;
  const restored = assertStoredGame(JSON.parse(JSON.stringify(game)));
  assert.deepEqual(publicState(restored), publicState(game));
  assert.deepEqual(restored.bag, game.bag);
  assert.equal(restored.roundId, game.roundId);
  assert.throws(() => assertStoredGame({ ...game, schemaVersion: 999 }), /refusing to overwrite/);
});

test('each shuffled cycle contains all 50 words and never repeats across its boundary', () => {
  let counter = 0;
  const options = { random: () => 0, makeRoundId: () => String(++counter), now: 5000 };
  let game = createGame(options);
  const firstCycle = [game.word];
  let lastWord = game.word;
  for (let i = 1; i <= 100; i++) {
    game = applyAction(game, action(game, 'next', { skip: true }), options).state;
    assert.notEqual(game.word, lastWord);
    if (i < 50) firstCycle.push(game.word);
    lastWord = game.word;
  }
  assert.equal(new Set(firstCycle).size, 50);
});

class FakeSocket {
  constructor(id, name) {
    this.readyState = 1;
    this.messages = [];
    this.attachment = { connectionId: id, clientId: id, name, closed: false,
      rateStart: Date.now(), rateCount: 0 };
  }
  serializeAttachment(value) { this.attachment = clone(value); }
  deserializeAttachment() { return clone(this.attachment); }
  send(value) { this.messages.push(value === 'pong' ? value : JSON.parse(value)); }
  close(code) { this.readyState = 3; this.closeCode = code; }
}

function roomContext(initial = fixture()) {
  const stored = new Map([[STORAGE_KEY, clone(initial)]]);
  const sockets = [
    new FakeSocket('11111111-1111-4111-8111-111111111111', 'Alex'),
    new FakeSocket('22222222-2222-4222-8222-222222222222', 'Sam'),
  ];
  const context = {
    sockets, stored,
    storage: {
      get: async key => clone(stored.get(key)),
      put: async (key, value) => { stored.set(key, clone(value)); },
    },
    blockConcurrencyWhile: callback => callback(),
    getWebSockets: () => sockets,
  };
  return context;
}
const readState = async room => (await room.fetch(new Request('https://example.test/privategames/api/state'))).json();

test('two overlapping players cannot lose a guess, and reads/broadcasts wait for durable writes', async () => {
  const ctx = roomContext();
  const room = new HangmanRoom(ctx, {});
  await room.ready;
  const round = room.game.roundId;
  let releaseWrite;
  let startedWrite;
  const started = new Promise(resolve => { startedWrite = resolve; });
  const gate = new Promise(resolve => { releaseWrite = resolve; });
  let writes = 0;
  ctx.storage.put = async (key, value) => {
    writes++;
    if (writes === 1) { startedWrite(); await gate; }
    ctx.stored.set(key, clone(value));
  };
  const first = room.webSocketMessage(ctx.sockets[0], JSON.stringify({ type: 'guess', roundId: round, letter: 'A' }));
  await started;
  const second = room.webSocketMessage(ctx.sockets[1], JSON.stringify({ type: 'guess', roundId: round, letter: 'Z' }));
  const snapshot = readState(room);
  assert.equal(room.game.guesses.length, 0, 'uncommitted state is not installed in memory');
  assert.equal(ctx.sockets[0].messages.length, 0, 'uncommitted moves are never broadcast');
  releaseWrite();
  await Promise.all([first, second]);
  const latest = await snapshot;
  assert.deepEqual(latest.state.guesses.map(guess => [guess.letter, guess.player]), [['A', 'Alex'], ['Z', 'Sam']]);
  assert.equal(latest.state.strikes, 1);
  assert.equal(ctx.stored.get(STORAGE_KEY).guesses.length, 2);
  assert.deepEqual(ctx.sockets[0].messages.at(-1), ctx.sockets[1].messages.at(-1));
  assert.equal(ctx.sockets[0].messages.at(-1).state.revision, latest.state.revision);
});

test('a failed durable write never becomes visible, and retry succeeds without losing other state', async () => {
  const ctx = roomContext();
  const room = new HangmanRoom(ctx, {});
  await room.ready;
  const revision = room.game.revision;
  const message = JSON.stringify(action(room.game, 'guess', { letter: 'Z' }));
  ctx.storage.put = async () => { throw new Error('simulated storage interruption'); };
  await room.webSocketMessage(ctx.sockets[0], message);
  assert.equal(room.game.revision, revision);
  assert.equal(ctx.stored.get(STORAGE_KEY).strikes, 0);
  assert.equal(ctx.sockets[0].messages[0].code, 'save_failed');
  assert.equal(ctx.sockets[1].messages.length, 0);
  ctx.storage.put = async (key, value) => { ctx.stored.set(key, clone(value)); };
  await room.webSocketMessage(ctx.sockets[0], message);
  assert.equal(room.game.strikes, 1);
  assert.equal(room.game.revision, revision + 1);
});

test('a fresh object restores the durable board and hibernated player attachments', async () => {
  const ctx = roomContext();
  const room = new HangmanRoom(ctx, {});
  await room.ready;
  for (const letter of new Set(room.game.word.toUpperCase())) {
    await room.webSocketMessage(ctx.sockets[0], JSON.stringify(action(room.game, 'guess', { letter })));
  }
  await room.webSocketMessage(ctx.sockets[1], JSON.stringify(action(room.game, 'next')));
  await room.webSocketMessage(ctx.sockets[0], JSON.stringify(action(room.game, 'guess', { letter: 'L' })));
  const before = await readState(room);
  const restored = new HangmanRoom(ctx, {});
  const after = await readState(restored);
  assert.deepEqual(after, before);
  assert.equal(after.players.length, 2);
  assert.equal(after.state.wins, 1);
  assert.equal(after.state.roundNumber, 2);
});

test('presence deduplicates tabs, rejects bad messages, and removes closed players', async () => {
  const ctx = roomContext();
  const room = new HangmanRoom(ctx, {});
  await room.ready;
  await room.webSocketMessage(ctx.sockets[1], JSON.stringify({ type: 'join',
    clientId: ctx.sockets[0].attachment.clientId, name: 'Alex Updated' }));
  assert.deepEqual((await readState(room)).players.map(player => player.name), ['Alex Updated']);
  await room.webSocketMessage(ctx.sockets[0], '{broken');
  assert.equal(ctx.sockets[0].messages.at(-1).code, 'invalid_message');
  await room.webSocketMessage(ctx.sockets[0], 'ping');
  assert.equal(ctx.sockets[0].messages.at(-1), 'pong');
  await room.webSocketClose(ctx.sockets[0], 1000);
  assert.equal((await readState(room)).players.length, 1);
  await room.webSocketMessage(ctx.sockets[1], 'x'.repeat(2049));
  assert.equal(ctx.sockets[1].closeCode, 1009);
  assert.equal((await readState(room)).players.length, 0);
});
