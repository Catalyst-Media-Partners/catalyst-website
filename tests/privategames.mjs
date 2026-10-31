import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, assertStoredGame, createGame, joinPlayer, migrateGame, publicState, refreshPlayers, reserveEntry, updatePushPreference, DEFAULT_SETTINGS, RECENT_WORD_LIMIT, WORD_BANK } from '../src/privategames/game.mjs';
import { nextAlarmAt, RECONNECT_GRACE_MS, PUSH_IDLE_MS, ROOM_IDLE_MS, VOTE_FALLBACK_MS } from '../src/privategames/turns.mjs';
import { HangmanRoom, STORAGE_KEY } from '../src/privategames/room.js';
import { PUSH_STORE_KEY, pushStatus } from '../src/privategames/push-store.mjs';
import { toBase64Url, VAPID_KEY_STORAGE_KEY } from '../src/privategames/push.mjs';

const IDS = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444'];
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const clone = value => structuredClone(value);
const activeId = game => game.turn.order[game.turn.cursor]?.id;
const allIds = game => new Set([...game.turn.order, ...game.turn.waiting].map(player => player.id));
const action = (game, type, extra = {}) => ({ type, roundId: game.roundId, turnToken: game.turn.token, ...extra });
const guess = (game, letter, playerId = activeId(game)) => applyAction(game, action(game, 'guess', { letter }), { playerId, now: 2000 });
function addPlayer(game, id, name, now = 1000) {
  const next = reserveEntry(game, now);
  return joinPlayer(next, { id, name, entryOrder: next.turn.nextEntry }, { now }).state;
}
function fixture(names = ['Alex'], word = 'parallel') {
  let game = createGame({ now: 1000 });
  game = { ...game, word, clue: WORD_BANK.find(entry => entry.word === word).clue,
    bag: WORD_BANK.map(entry => entry.word).filter(value => value !== word) };
  for (const [index, name] of names.entries()) game = addPlayer(game, IDS[index], name);
  return game;
}

// Gameplay invariants remain the same while the server now advances turn tokens.
test('50 unique alphabetic words all fit the 15-letter maximum', () => {
  assert.equal(WORD_BANK.length, 50);
  assert.equal(new Set(WORD_BANK.map(entry => entry.word)).size, 50);
  assert(WORD_BANK.every(entry => /^[a-z]{1,15}$/.test(entry.word)));
  assert.equal(Math.max(...WORD_BANK.map(entry => entry.word.length)), 15);
});

test('correct guesses reveal every repeated letter and active snapshots hide the answer and bag', () => {
  const initial = fixture();
  const first = guess(initial, 'l');
  assert.equal(first.state.strikes, 0);
  assert.deepEqual(publicState(first.state).mask, [null,null,null,null,'L','L',null,'L']);
  assert.equal(first.state.guesses[0].player, 'Alex');
  const before = publicState(initial);
  assert.equal(before.answer, null);
  assert.equal(before.clue, null);
  assert.equal('word' in before, false);
  assert.equal('bag' in before, false);
  assert(!JSON.stringify(before).toLowerCase().includes(initial.word));
  assert.deepEqual(initial.guesses, []);
});

test('ninth incorrect unique guess remains playable and the tenth loses exactly once', () => {
  let game = fixture();
  const wrong = [...ALPHABET].filter(letter => !game.word.toUpperCase().includes(letter));
  for (const letter of wrong.slice(0,9)) game = guess(game, letter).state;
  assert.equal(game.status, 'playing');
  assert.equal(game.strikes, 9);
  assert.equal(game.losses, 0);
  const duplicate = guess(game, wrong[0]);
  assert.equal(duplicate.changed, false);
  game = guess(game, wrong[9]).state;
  assert.equal(game.status, 'lost');
  assert.equal(game.strikes, 10);
  assert.equal(game.losses, 1);
  assert.equal(publicState(game).answer, 'PARALLEL');
  assert.equal(guess(game, 'P').changed, false);
  assert.equal(guess(game, 'P').state.losses, 1);
});

test('solving records one win and locks the finished word', () => {
  let game = fixture();
  for (const letter of new Set(game.word.toUpperCase())) game = guess(game, letter).state;
  assert.equal(game.status, 'won');
  assert.equal(game.wins, 1);
  assert.equal(game.losses, 0);
  assert.equal(game.strikes, 0);
  assert.equal(game.clueShown, true);
  assert.equal(game.clueEnabled, false, 'automatic end-of-word clue is not a clicked hint');
  assert.equal(guess(game, 'Z').changed, false);
});

test('entry order wins even if initial join messages arrive in the opposite order', () => {
  let game = createGame({ now: 1000 });
  game = reserveEntry(game, 1000); const firstEntry = game.turn.nextEntry;
  game = reserveEntry(game, 1000); const secondEntry = game.turn.nextEntry;
  game = joinPlayer(game, { id: IDS[1], name: 'Sam', entryOrder: secondEntry }).state;
  assert.equal(activeId(game), IDS[1]);
  const tokenBefore = game.turn.token;
  game = joinPlayer(game, { id: IDS[0], name: 'Alex', entryOrder: firstEntry }).state;
  assert.deepEqual(game.turn.order.map(player => player.id), IDS.slice(0,2));
  assert.equal(activeId(game), IDS[0]);
  assert.notEqual(game.turn.token, tokenBefore);
});

test('correct and incorrect guesses consume one turn; duplicate, invalid and out-of-turn guesses consume none', () => {
  let game = fixture(['Alex','Sam','Casey']);
  const oldToken = game.turn.token;
  assert.equal(guess(game, 'P', IDS[1]).code, 'out_of_turn');
  assert.equal(game.turn.token, oldToken);
  game = guess(game, 'P').state;
  assert.equal(activeId(game), IDS[1]);
  const samToken = game.turn.token;
  for (const letter of ['P','','AB','1','é',null,{},' A']) {
    const result = guess(game, letter);
    assert.equal(result.changed, false);
    assert.equal(result.state.turn.token, samToken);
  }
  game = guess(game, 'Z').state;
  assert.equal(game.strikes, 1);
  assert.equal(activeId(game), IDS[2]);
  game = guess(game, 'A').state;
  assert.equal(activeId(game), IDS[0]);
  assert.equal(game.turn.cycle, 2);
});

test('late arrivals wait until the whole current player cycle finishes and names do not change order', () => {
  let game = fixture(['Alex','Sam','Casey']);
  game = guess(game, 'P').state;
  game = addPlayer(game, IDS[3], 'Drew');
  assert.equal(activeId(game), IDS[1]);
  assert.deepEqual(game.turn.waiting.map(player => player.id), [IDS[3]]);
  assert.equal(guess(game, 'Z', IDS[3]).code, 'waiting_for_cycle');
  const renamed = joinPlayer(game, { id: IDS[1], name: 'Sam renamed', entryOrder: 999 }).state;
  assert.deepEqual(renamed.turn.order.map(player => player.id), IDS.slice(0,3));
  assert.equal(renamed.turn.order[1].entryOrder, game.turn.order[1].entryOrder);
  game = guess(renamed, 'Z').state;
  assert.equal(game.turn.waiting.length, 1);
  game = guess(game, 'A').state;
  assert.deepEqual(game.turn.order.map(player => player.id), IDS);
  assert.equal(game.turn.waiting.length, 0);
  assert.equal(activeId(game), IDS[0]);
  assert.equal(game.turn.cycle, 2);
});

test('solo cycle wrap still rejects an old token, so duplicate tabs cannot take two turns with one token', () => {
  let game = fixture();
  const stale = action(game, 'guess', { letter: 'Z' });
  game = guess(game, 'L').state;
  assert.equal(activeId(game), IDS[0]);
  const result = applyAction(game, stale, { playerId: IDS[0] });
  assert.equal(result.code, 'stale_turn');
  assert.equal(result.state.strikes, 0);
  const oldClient = action(game, 'guess', { letter: 'Z' });
  delete oldClient.turnToken;
  assert.equal(applyAction(game, oldClient, { playerId: IDS[0] }).code, 'client_update_required');
});

test('word completion and Next preserve the ongoing player cycle and pending arrivals', () => {
  let game = fixture(['Alex','Sam','Casey']);
  for (const letter of 'PARL') game = guess(game, letter).state;
  assert.equal(activeId(game), IDS[1]);
  assert.equal(game.turn.cycle, 2);
  game = addPlayer(game, IDS[3], 'Drew');
  game = guess(game, 'E').state;
  assert.equal(game.status, 'won');
  assert.equal(activeId(game), IDS[2]);
  assert.equal(game.turn.waiting.length, 1);
  const previous = game;
  const nextRequest = action(game, 'next');
  assert.equal(applyAction(game, nextRequest, { playerId: IDS[0] }).code, 'out_of_turn');
  game = applyAction(game, nextRequest, { playerId: IDS[2] }).state;
  assert.equal(activeId(game), IDS[2]);
  assert.equal(game.turn.cycle, previous.turn.cycle);
  assert.equal(game.turn.started, true);
  assert.equal(game.turn.waiting.length, 1);
  assert.notEqual(game.turn.token, previous.turn.token);
  assert.equal(game.roundNumber, previous.roundNumber + 1);
  assert.equal(applyAction(game, nextRequest, { playerId: IDS[2] }).code, 'stale_round');
  game = guess(game, game.word[0]).state;
  assert.equal(activeId(game), IDS[0]);
  assert.deepEqual(game.turn.order.map(player => player.id), IDS);
  assert.equal(game.turn.cycle, 3);
});

test('a clicked clue resets on the next round without advancing anyone’s turn', () => {
  let game = fixture(['Alex','Sam']);
  const turnBefore = clone(game.turn);
  game = applyAction(game, action(game, 'hint'), { playerId: IDS[1], now: 1000 }).state;
  assert.equal(game.clueEnabled, true);
  assert.deepEqual(game.turn, turnBefore);
  game = applyAction(game, action(game, 'next', { skip: true }), { playerId: IDS[0] }).state;
  assert.equal(game.clueShown, false);
  assert.equal(publicState(game).clue, null);
  assert.equal(game.turn.cursor, 0);
  assert.equal(applyAction(game, action(game, 'hint'), { playerId: IDS[1] }).changed, true);
  game = guess(game, game.word[0]).state;
  game = addPlayer(game, IDS[2], 'Casey');
  assert.equal(applyAction(game, action(game, 'hint'), { playerId: IDS[2] }).code, 'waiting_for_cycle');
});

test('schema1 migration preserves the exact live word, bag, guesses and score', () => {
  let current = fixture();
  current = guess(current, 'A').state;
  current = guess(current, 'Z').state;
  current = applyAction(current, action(current, 'hint'), { playerId: IDS[0] }).state;
  const legacy = clone(current);
  legacy.schemaVersion = 1; delete legacy.turn; delete legacy.clueEnabled;
  const migrated = migrateGame(legacy);
  for (const field of ['roundId','roundNumber','word','clue','bag','guesses','strikes','status','wins','losses','clueShown','updatedAt']) {
    assert.deepEqual(migrated[field], legacy[field], field);
  }
  assert.equal(migrated.clueEnabled, true);
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.turn.order.length, 0);
  assertStoredGame(migrated);
  assert.throws(() => migrateGame({ ...legacy, schemaVersion: 999 }), /refusing to overwrite/);
});

test('a reconnect inside the 12-second grace keeps the same slot and token', () => {
  let game = fixture(['Alex','Sam','Casey']);
  const token = game.turn.token;
  game = refreshPlayers(game, new Set(IDS.slice(1,3)), { now: 10_000 }).state;
  assert.equal(publicState(game, new Set(IDS.slice(1,3))).turn.graceEndsAt, 10_000 + RECONNECT_GRACE_MS);
  assert.equal(activeId(game), IDS[0]);
  game = refreshPlayers(game, allIds(game), { now: 10_000 + RECONNECT_GRACE_MS - 1 }).state;
  assert.equal(activeId(game), IDS[0]);
  assert.equal(game.turn.token, token);
  assert.equal(game.turn.order[0].disconnectedAt, null);
  assert.equal(nextAlarmAt(game.turn), null);
});

test('expired current player is skipped and waiting players still enter only at the cycle boundary', () => {
  let game = fixture(['Alex','Sam','Casey']);
  game = guess(game, 'P').state;
  game = addPlayer(game, IDS[3], 'Drew');
  const online = new Set([IDS[0],IDS[2],IDS[3]]);
  game = refreshPlayers(game, online, { now: 10_000 }).state;
  game = refreshPlayers(game, online, { now: 10_000 + RECONNECT_GRACE_MS }).state;
  assert.equal(activeId(game), IDS[2]);
  assert.equal(game.turn.cycle, 1);
  assert.deepEqual(game.turn.waiting.map(player => player.id), [IDS[3]]);
  game = guess(game, 'Z').state;
  assert.equal(game.turn.cycle, 2);
  assert.deepEqual(game.turn.order.map(player => player.id), [IDS[0],IDS[2],IDS[3]]);
  assert.equal(activeId(game), IDS[0]);
});

test('expired noncurrent members do not steal the current player’s turn', () => {
  let game = fixture(['Alex','Sam','Casey']);
  game = guess(game, 'P').state;
  const token = game.turn.token;
  const online = new Set([IDS[1]]);
  game = refreshPlayers(game, online, { now: 10_000 }).state;
  game = refreshPlayers(game, online, { now: 10_000 + RECONNECT_GRACE_MS }).state;
  assert.equal(activeId(game), IDS[1]);
  assert.equal(game.turn.token, token);
  assert.deepEqual(game.turn.order.map(player => player.id), [IDS[1]]);
});

test('all incumbent disconnects promote waiting players, and an empty room stops scheduling alarms', () => {
  let game = fixture(['Alex','Sam','Casey']);
  game = guess(game, 'P').state;
  game = addPlayer(game, IDS[3], 'Drew');
  const drewOnly = new Set([IDS[3]]);
  game = refreshPlayers(game, drewOnly, { now: 10_000 }).state;
  game = refreshPlayers(game, drewOnly, { now: 10_000 + RECONNECT_GRACE_MS }).state;
  assert.equal(activeId(game), IDS[3]);
  assert.deepEqual(game.turn.order.map(player => player.id), [IDS[3]]);
  assert.equal(game.turn.waiting.length, 0);
  assert.equal(game.turn.cycle, 2);
  game = refreshPlayers(game, new Set(), { now: 30_000 }).state;
  game = refreshPlayers(game, new Set(), { now: 30_000 + RECONNECT_GRACE_MS }).state;
  const empty = clone(game);
  assert.equal(activeId(game), undefined);
  assert.equal(nextAlarmAt(game.turn), null);
  assert.equal(refreshPlayers(game, new Set(), { now: 90_000 }).changed, false);
  game = addPlayer(game, IDS[0], 'Alex returns', 90_000);
  assert.equal(activeId(game), IDS[0]);
  assert.equal(game.word, empty.word);
  assert.deepEqual(game.guesses, empty.guesses);
});

test('serialization restores game, sticky hint, cursor, token, pending roster and shuffle order', () => {
  let game = fixture(['Alex','Sam','Casey']);
  game = guess(game, 'A').state;
  game = addPlayer(game, IDS[3], 'Drew');
  game = applyAction(game, action(game, 'hint'), { playerId: IDS[0] }).state;
  const restored = assertStoredGame(JSON.parse(JSON.stringify(game)));
  assert.deepEqual(restored, game);
  assert.deepEqual(publicState(restored, allIds(game)), publicState(game, allIds(game)));
});

test('dictionary transitions avoid recent words and store only bounded selection history', () => {
  let counter = 0;
  const options = { random: () => 0, makeRoundId: () => String(++counter), now: 5000, playerId: IDS[0] };
  let game = addPlayer(createGame(options), IDS[0], 'Alex');
  const firstCycle = [game.word]; let previous = game.word;
  for (let i=1;i<=100;i++) {
    game = applyAction(game, action(game, 'next', { skip: true }), options).state;
    assert.notEqual(game.word, previous);
    if (i<50) firstCycle.push(game.word);
    previous = game.word;
  }
  assert.equal(new Set(firstCycle).size, 50);
  assert.equal(game.recentWords.length, RECENT_WORD_LIMIT);
  assert.deepEqual(game.bag, []);
  assert.equal(new Set(game.recentWords).size, RECENT_WORD_LIMIT);
});

class FakeSocket {
  constructor(id, name, entryOrder = 1, joined = true) {
    this.readyState = 1; this.messages = [];
    this.attachment = { connectionId: id, clientId: id, name, entryOrder, joined, closed: false,
      rateStart: Date.now(), rateCount: 0 };
  }
  serializeAttachment(value) { this.attachment = clone(value); }
  deserializeAttachment() { return clone(this.attachment); }
  send(value) { this.messages.push(value === 'pong' ? value : JSON.parse(value)); }
  close(code) { this.readyState = 3; this.closeCode = code; }
}
function roomContext(initial = fixture(['Alex','Sam'])) {
  initial = clone(initial);
  if (initial.schemaVersion === 3) {
    initial.turn.lastActivityAt = Date.now();
    if (initial.turn.deadlineAt !== null) initial.turn.deadlineAt = Date.now() + (initial.settings.turnMode === 'timer' ? initial.settings.turnSeconds * 1000 : VOTE_FALLBACK_MS);
  }
  const stored = new Map([[STORAGE_KEY, clone(initial)]]);
  const sockets = initial.turn ? [...initial.turn.order,...initial.turn.waiting].map(player =>
    new FakeSocket(player.id,player.name,player.entryOrder)) : [];
  let alarm = null;
  const context = {
    sockets, stored,
    storage: {
      get: async key => clone(stored.get(key)),
      put: async (key,value) => { stored.set(key,clone(value)); },
      getAlarm: async () => alarm,
      setAlarm: async value => { alarm = value; },
      deleteAlarm: async () => { alarm = null; },
      transaction: async callback => {
        const before = new Map([...stored].map(([key,value]) => [key,clone(value)]));
        const beforeAlarm = alarm;
        try { return await callback(); }
        catch (error) {
          stored.clear(); for (const [key,value] of before) stored.set(key,value);
          alarm = beforeAlarm; throw error;
        }
      },
    },
    blockConcurrencyWhile: callback => callback(),
    getWebSockets: () => sockets,
  };
  return context;
}
const readState = async room => (await room.fetch(new Request('https://example.test/privategames/api/state'))).json();
const send = (room,socket,request) => room.webSocketMessage(socket,JSON.stringify(request));
async function pendingSocket(ctx,room,id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') {
  await room.commit(reserveEntry(room.game));
  const socket = new FakeSocket(id,'Guest',room.game.turn.nextEntry,false);
  ctx.sockets.push(socket);
  return socket;
}

test('overlapping writes never publish early and stale overlapping turn messages cannot consume a second turn', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  const firstRequest = action(room.game,'guess',{letter:'P'});
  const staleSecond = action(room.game,'guess',{letter:'Z'});
  let releaseWrite, startedWrite;
  const started = new Promise(resolve => { startedWrite = resolve; });
  const gate = new Promise(resolve => { releaseWrite = resolve; });
  let writes = 0;
  ctx.storage.put = async (key,value) => {
    if (++writes === 1) { startedWrite(); await gate; }
    ctx.stored.set(key,clone(value));
  };
  const first = send(room,ctx.sockets[0],firstRequest); await started;
  const second = send(room,ctx.sockets[1],staleSecond);
  const snapshot = readState(room);
  assert.equal(room.game.guesses.length,0);
  assert.equal(ctx.sockets[0].messages.length,0);
  releaseWrite(); await Promise.all([first,second]);
  const latest = await snapshot;
  assert.equal(latest.state.guesses.length,1);
  assert.equal(latest.state.turn.activePlayerId,IDS[1]);
  assert(ctx.sockets[1].messages.some(message => message.code === 'stale_turn'));
  await send(room,ctx.sockets[1],action(room.game,'guess',{letter:'Z'}));
  assert.deepEqual(room.game.guesses.map(value => [value.letter,value.player]),[['P','Alex'],['Z','Sam']]);
  assert.deepEqual(ctx.sockets[0].messages.at(-1),ctx.sockets[1].messages.at(-1));
});

test('failed durable transaction does not consume a turn or show an unsaved move', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  const before = clone(room.game);
  const request = action(room.game,'guess',{letter:'Z'});
  ctx.storage.put = async () => { throw new Error('simulated storage interruption'); };
  await send(room,ctx.sockets[0],request);
  assert.deepEqual(room.game,before);
  assert.deepEqual(ctx.stored.get(STORAGE_KEY),before);
  assert.equal(ctx.sockets[0].messages[0].code,'save_failed');
  assert.equal(ctx.sockets[1].messages.length,0);
  ctx.storage.put = async (key,value) => { ctx.stored.set(key,clone(value)); };
  await send(room,ctx.sockets[0],request);
  assert.equal(room.game.strikes,1);
  assert.equal(activeId(room.game),IDS[1]);
});

test('hibernation restores current turn, scores, clue preference and player attachments', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  await send(room,ctx.sockets[0],action(room.game,'hint'));
  for (const letter of new Set(room.game.word.toUpperCase())) {
    const socket = ctx.sockets.find(socket => socket.attachment.clientId === activeId(room.game));
    await send(room,socket,action(room.game,'guess',{letter}));
  }
  const nextPlayer = ctx.sockets.find(socket => socket.attachment.clientId === activeId(room.game));
  await send(room,nextPlayer,action(room.game,'next'));
  const before = await readState(room);
  const restored = new HangmanRoom(ctx,{});
  const after = await readState(restored);
  assert(after.serverTime >= before.serverTime);
  assert.deepEqual({ ...after, serverTime: 0 },{ ...before, serverTime: 0 });
  assert.equal(after.state.wins,1);
  assert.equal(after.state.roundNumber,2);
  assert.equal(after.state.clueShown,false);
});

test('unjoined sockets take no slot; duplicate tabs retain one identity and cannot switch to another player', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  const duplicate = await pendingSocket(ctx,room);
  assert.equal((await readState(room)).players.length,2);
  assert.equal(room.game.turn.order.length,2);
  await send(room,duplicate,{type:'join',clientId:IDS[0],name:'Alex Updated'});
  assert.equal(room.game.turn.order.length,2);
  assert.equal((await readState(room)).players.length,2);
  assert.equal(room.game.turn.order[0].name,'Alex Updated');
  await room.webSocketClose(ctx.sockets[0],1000);
  assert.equal(room.game.turn.order[0].disconnectedAt,null);
  assert.equal(await ctx.storage.getAlarm(),room.game.turn.deadlineAt);
  await send(room,duplicate,{type:'join',clientId:IDS[1],name:'Impersonating Sam'});
  assert.equal(duplicate.messages.at(-1).code,'identity_locked');
  const oneToken = action(room.game,'guess',{letter:'P'});
  await send(room,duplicate,oneToken);
  await send(room,duplicate,{...oneToken,letter:'Z'});
  assert.equal(room.game.guesses.length,1);
  assert.equal(room.game.strikes,0);
});

test('old connected sockets are enrolled during migration and receive a refresh instruction without taking a turn', async () => {
  let legacy = fixture(['Alex','Sam']);
  legacy = guess(legacy,'A').state;
  legacy.schemaVersion = 1; delete legacy.turn; delete legacy.clueEnabled;
  const ctx = roomContext(legacy);
  for (const [index,name] of ['Alex','Sam'].entries()) {
    const socket = new FakeSocket(IDS[index],name);
    delete socket.attachment.joined; delete socket.attachment.entryOrder;
    ctx.sockets.push(socket);
  }
  const room = new HangmanRoom(ctx,{}); await room.ready;
  assert.deepEqual(room.game.turn.order.map(player => player.id),IDS.slice(0,2));
  assert.deepEqual(room.game.guesses,legacy.guesses);
  assert.equal(room.game.word,legacy.word);
  await send(room,ctx.sockets[0],{type:'guess',roundId:room.game.roundId,letter:'Z'});
  assert(ctx.sockets[0].messages.some(message => message.code === 'client_update_required' && /Refresh this page/.test(message.message)));
  assert.deepEqual(room.game.guesses,legacy.guesses);
});

test('durable alarm advances a disconnected current player and stops once the roster is empty', async () => {
  const originalNow = Date.now; let now = 100_000; Date.now = () => now;
  try {
    const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
    const savedWord = room.game.word;
    await room.webSocketClose(ctx.sockets[0],1000);
    assert.equal(activeId(room.game),IDS[0]);
    assert.equal(await ctx.storage.getAlarm(),now + RECONNECT_GRACE_MS);
    now += RECONNECT_GRACE_MS;
    await room.alarm();
    assert.equal(activeId(room.game),IDS[1]);
    assert.equal(room.game.word,savedWord);
    assert.equal(room.game.guesses.length,0);
    assert.equal(await ctx.storage.getAlarm(),null);
    await room.webSocketClose(ctx.sockets[1],1000);
    now += RECONNECT_GRACE_MS;
    await room.alarm();
    assert.equal(room.game.turn.order.length,0);
    assert.equal(await ctx.storage.getAlarm(),null);
    const after = clone(room.game);
    await room.alarm();
    assert.deepEqual(room.game,after);
  } finally { Date.now = originalNow; }
});

test('bad frames do not leave a disconnected current player permanently occupying its turn', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  await room.webSocketMessage(ctx.sockets[0],'{broken');
  assert.equal(ctx.sockets[0].messages.at(-1).code,'invalid_message');
  await room.webSocketMessage(ctx.sockets[0],'ping');
  assert.equal(ctx.sockets[0].messages.at(-1),'pong');
  await room.webSocketMessage(ctx.sockets[0],'x'.repeat(8193));
  assert.equal(ctx.sockets[0].closeCode,1009);
  assert.notEqual(room.game.turn.order[0].disconnectedAt,null);
  assert.notEqual(await ctx.storage.getAlarm(),null);
});

test('a transient disconnect-save failure schedules recovery instead of permanently stalling the turn', async () => {
  const originalNow = Date.now; let now = 200_000; Date.now = () => now;
  try {
    const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
    ctx.storage.put = async () => { throw new Error('transient disconnect write failure'); };
    await room.webSocketClose(ctx.sockets[0],1000);
    assert.equal(activeId(room.game),IDS[0]);
    assert.equal(await ctx.storage.getAlarm(),now + 1000);
    ctx.storage.put = async (key,value) => { ctx.stored.set(key,clone(value)); };
    now += 1000; await room.alarm();
    assert.equal(await ctx.storage.getAlarm(),now + RECONNECT_GRACE_MS);
    now += RECONNECT_GRACE_MS; await room.alarm();
    assert.equal(activeId(room.game),IDS[1]);
    assert.equal(await ctx.storage.getAlarm(),null);
    assert.equal(room.game.guesses.length,0);
  } finally { Date.now = originalNow; }
});

test('schema2 upgrade preserves the live game and ordered turn while adding default settings', () => {
  let current = fixture(['Alex','Sam','Casey']);
  current = guess(current,'A').state;
  current = addPlayer(current,IDS[3],'Drew');
  const legacy = clone(current);
  legacy.schemaVersion = 2;
  delete legacy.settings; delete legacy.recentWords;
  for (const key of ['vote','deadlineAt','remainingMs','clockKind','paused','lastActivityAt','lastPass']) delete legacy.turn[key];
  for (const player of [...legacy.turn.order,...legacy.turn.waiting]) delete player.pushEnabled;
  const migrated = migrateGame(legacy,{now:100_000});
  for (const field of ['roundId','roundNumber','word','clue','bag','guesses','strikes','status','wins','losses','clueShown','clueEnabled','updatedAt']) {
    assert.deepEqual(migrated[field],legacy[field],field);
  }
  for (const field of ['token','cursor','cycle','started','nextEntry']) assert.equal(migrated.turn[field],legacy.turn[field],field);
  assert.deepEqual(migrated.turn.order.map(player=>player.id),legacy.turn.order.map(player=>player.id));
  assert.deepEqual(migrated.turn.waiting.map(player=>player.id),legacy.turn.waiting.map(player=>player.id));
  assert.deepEqual(migrated.settings,DEFAULT_SETTINGS);
  assert.deepEqual(migrated.recentWords,[legacy.word]);
  assertStoredGame(migrated);
});

test('only current Next applies valid word and timer settings, without resetting scores or player cycle', () => {
  let game = fixture(['Alex','Sam','Casey']);
  game = guess(game,'P').state;
  const before = clone(game);
  const settings = { vocabulary:'dictionary',minLength:12,maxLength:15,turnMode:'timer',turnSeconds:60 };
  const request = action(game,'next',{skip:true,settings});
  assert.equal(applyAction(game,request,{playerId:IDS[0]}).code,'out_of_turn');
  for (const settings of [null,[],{minLength:2},{maxLength:16},{minLength:8,maxLength:3},{vocabulary:'easy',minLength:15,maxLength:15},{turnMode:'instant'},{turnSeconds:1}]) {
    const result = applyAction(game,action(game,'next',{skip:true,settings}),{playerId:IDS[1]});
    assert.equal(result.code,'invalid_settings'); assert.strictEqual(result.state,game);
  }
  game = applyAction(game,request,{playerId:IDS[1],now:10_000}).state;
  assert.deepEqual(game.settings,{...settings,puzzleMode:'word'});
  assert(game.word.length >=12 && game.word.length <=15);
  assert.notEqual(game.word,before.word);
  assert.equal(game.turn.cursor,before.turn.cursor);
  assert.equal(game.turn.cycle,before.turn.cycle);
  assert.equal(game.wins,before.wins); assert.equal(game.losses,before.losses);
  assert.equal(game.turn.deadlineAt,70_000);
  assert.deepEqual(publicState(game).settings,{...settings,puzzleMode:'word'});
});

test('a democratic skip needs two distinct eligible peers and never charges a strike', () => {
  let game = fixture(['Alex','Sam','Casey']);
  const stale = action(game,'voteSkip');
  assert.deepEqual(game.turn.vote.eligibleIds,[IDS[1],IDS[2]]);
  assert.equal(game.turn.vote.required,2);
  assert.equal(game.turn.deadlineAt,null);
  assert.equal(applyAction(game,stale,{playerId:IDS[0]}).code,'vote_own_turn');
  game = applyAction(game,stale,{playerId:IDS[1],now:2000}).state;
  assert.equal(activeId(game),IDS[0]);
  assert.deepEqual(game.turn.vote.voterIds,[IDS[1]]);
  assert.equal(applyAction(game,stale,{playerId:IDS[1]}).changed,false);
  game = applyAction(game,stale,{playerId:IDS[2],now:3000}).state;
  assert.equal(activeId(game),IDS[1]);
  assert.equal(game.turn.lastPass.reason,'vote');
  assert.equal(game.strikes,0); assert.equal(game.guesses.length,0);
  assert.equal(game.wins,0); assert.equal(game.losses,0);
  assert.deepEqual(game.turn.vote.voterIds,[]);
  assert.equal(applyAction(game,stale,{playerId:IDS[1]}).code,'stale_turn');
});

test('vote electorate tracks initial arrivals until first vote, then expires without auto-accepting an old minority', () => {
  let game = fixture(['Alex','Sam']);
  assert.equal(game.turn.vote.required,2);
  game = addPlayer(game,IDS[2],'Casey');
  assert.deepEqual(game.turn.vote.eligibleIds,[IDS[1],IDS[2]]);
  game = addPlayer(game,IDS[3],'Drew');
  assert.equal(game.turn.vote.required,2);
  game = applyAction(game,action(game,'voteSkip'),{playerId:IDS[1],now:2000}).state;
  const token = game.turn.token;
  const online = new Set([IDS[0],IDS[1],IDS[2]]);
  game = refreshPlayers(game,online,{now:3000}).state;
  assert.equal(game.turn.vote.eligibleIds.length,3,'a transient disconnect does not alter an open ballot');
  assert.deepEqual(game.turn.vote.voterIds,[IDS[1]]);
  game = refreshPlayers(game,online,{now:3000+RECONNECT_GRACE_MS}).state;
  assert.equal(game.turn.token,token);
  assert.equal(activeId(game),IDS[0]);
  assert.deepEqual(game.turn.vote.eligibleIds,[IDS[1],IDS[2]]);
  assert.deepEqual(game.turn.vote.voterIds,[],'departure requires a fresh ballot');
  game = guess(game,'P').state;
  game = addPlayer(game,IDS[3],'Drew');
  assert.equal(game.turn.waiting.length,1);
  assert.equal(applyAction(game,action(game,'voteSkip'),{playerId:IDS[3]}).code,'waiting_for_cycle');
});

test('one peer cannot vote-skip; two-player vote mode has a 90-second fallback and voluntary pass', () => {
  let game = fixture(['Alex','Sam']);
  const request = action(game,'voteSkip');
  assert.equal(applyAction(game,request,{playerId:IDS[1],now:2000}).code,'not_enough_voters');
  assert.equal(game.turn.deadlineAt,1000+VOTE_FALLBACK_MS);
  game = refreshPlayers(game,allIds(game),{now:game.turn.deadlineAt}).state;
  assert.equal(activeId(game),IDS[1]);
  assert.equal(game.turn.lastPass.reason,'timeout');
  assert.equal(game.strikes,0);
  game = applyAction(game,action(game,'pass'),{playerId:IDS[1],now:100_000}).state;
  assert.equal(activeId(game),IDS[0]);
  assert.equal(game.turn.lastPass.reason,'voluntary');
  assert.equal(game.turn.cycle,2);
  const solo = fixture();
  assert.equal(solo.turn.deadlineAt,null);
});

test('timer mode uses the configured duration, invalidates old actions, and cannot vote-skip', () => {
  let game = fixture(['Alex','Sam','Casey']);
  game = applyAction(game,action(game,'next',{skip:true,settings:{turnMode:'timer',turnSeconds:120}}),
    {playerId:IDS[0],now:5000}).state;
  const request = action(game,'guess',{letter:'Z'});
  const before = clone(game);
  assert.equal(game.turn.deadlineAt,125_000);
  assert.equal(applyAction(game,action(game,'voteSkip'),{playerId:IDS[1]}).code,'vote_disabled');
  assert.equal(refreshPlayers(game,allIds(game),{now:124_999}).changed,false);
  game = refreshPlayers(game,allIds(game),{now:125_000}).state;
  assert.equal(activeId(game),IDS[1]);
  assert.equal(game.turn.deadlineAt,245_000);
  assert.equal(applyAction(game,request,{playerId:IDS[0]}).code,'stale_turn');
  for (const field of ['word','guesses','strikes','wins','losses']) assert.deepEqual(game[field],before[field]);
  assert.equal(refreshPlayers(game,allIds(game),{now:125_000}).changed,false,'replayed alarms do not pass twice');
});

test('background push members retain their place, but an offline owner gets only 90 seconds to return', () => {
  let game = fixture(['Alex','Sam','Casey']);
  game = updatePushPreference(game,IDS[0],true,{now:1000}).state;
  const online = new Set([IDS[1],IDS[2]]);
  game = refreshPlayers(game,online,{now:2000}).state;
  const token = game.turn.token;
  assert.equal(game.turn.order[0].pushEnabled,true);
  assert.equal(game.turn.deadlineAt,2000+VOTE_FALLBACK_MS);
  assert.equal(publicState(game,online).turn.graceEndsAt,2000+PUSH_IDLE_MS);
  game = refreshPlayers(game,online,{now:2000+RECONNECT_GRACE_MS}).state;
  assert.equal(game.turn.order.length,3); assert.equal(game.turn.token,token);
  game = refreshPlayers(game,online,{now:2000+VOTE_FALLBACK_MS}).state;
  assert.equal(activeId(game),IDS[1]);
  assert.equal(game.turn.lastPass.reason,'offline');
  assert.equal(game.turn.order.length,3); assert.equal(game.strikes,0);
  game = refreshPlayers(game,online,{now:2000+PUSH_IDLE_MS}).state;
  assert.equal(game.turn.order.some(player=>player.id===IDS[0]),false);
});

test('all-offline rooms pause timer progress and stop alarms after bounded retention expires', () => {
  let game = fixture(['Alex','Sam']);
  for (const id of IDS.slice(0,2)) game = updatePushPreference(game,id,true,{now:1000}).state;
  game = applyAction(game,action(game,'next',{skip:true,settings:{turnMode:'timer',turnSeconds:60}}),
    {playerId:IDS[0],now:2000}).state;
  game = refreshPlayers(game,new Set(),{now:12_000}).state;
  const token = game.turn.token;
  assert.equal(game.turn.paused,true); assert.equal(game.turn.deadlineAt,null); assert.equal(game.turn.remainingMs,50_000);
  assert.equal(nextAlarmAt(game.turn),12_000+PUSH_IDLE_MS);
  game = refreshPlayers(game,new Set([IDS[0]]),{now:30_000}).state;
  assert.equal(game.turn.token,token); assert.equal(game.turn.deadlineAt,80_000);
  game = refreshPlayers(game,new Set(),{now:31_000}).state;
  game = refreshPlayers(game,new Set(),{now:31_000+PUSH_IDLE_MS}).state;
  assert.equal(game.turn.order.length,0); assert.equal(nextAlarmAt(game.turn),null);
});

test('a forgotten connected browser cannot run timers forever without deliberate activity', () => {
  let game = fixture(['Alex','Sam']);
  game = applyAction(game,action(game,'next',{skip:true,settings:{turnMode:'timer',turnSeconds:60}}),
    {playerId:IDS[0],now:1000}).state;
  let iterations = 0;
  while (game.turn.deadlineAt !== null && ++iterations < 40) {
    game = refreshPlayers(game,allIds(game),{now:game.turn.deadlineAt}).state;
  }
  assert(iterations <=30);
  assert.equal(game.turn.paused,true);
  assert.equal(game.turn.lastActivityAt,1000);
  assert.equal(nextAlarmAt(game.turn),null);
  const current = activeId(game);
  game = applyAction(game,action(game,'pass'),{playerId:current,now:ROOM_IDLE_MS+2000}).state;
  assert.equal(game.turn.paused,false); assert.notEqual(game.turn.deadlineAt,null);
});

test('explicit Leave removes waiting and active players fairly and preserves the board', () => {
  let game = fixture(['Alex','Sam','Casey']);
  game = guess(game,'P').state;
  game = addPlayer(game,IDS[3],'Drew');
  const token = game.turn.token;
  const waiting = applyAction(game,action(game,'leave'),{playerId:IDS[3],now:3000});
  assert.equal(waiting.left,true); game = waiting.state;
  assert.equal(game.turn.waiting.length,0); assert.equal(game.turn.token,token);
  const before = clone(game);
  const leaving = applyAction(game,action(game,'leave'),{playerId:IDS[1],now:4000});
  assert.equal(leaving.left,true); game = leaving.state;
  assert.equal(activeId(game),IDS[2]); assert.equal(game.turn.cycle,before.turn.cycle);
  for (const field of ['word','guesses','strikes','wins','losses']) assert.deepEqual(game[field],before[field]);
});

const secret = () => toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
async function subscription(suffix = 'device') {
  const pair = await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  return { endpoint:`https://fcm.googleapis.com/fcm/send/${suffix}`,expirationTime:null,
    keys:{p256dh:toBase64Url(await crypto.subtle.exportKey('raw',pair.publicKey)),auth:toBase64Url(crypto.getRandomValues(new Uint8Array(16)))} };
}
async function enablePush(room,socket,suffix = 'device') {
  const ownerSecret = secret();
  await send(room,socket,{type:'join',clientId:socket.attachment.clientId,name:socket.attachment.name,ownerSecret});
  await send(room,socket,{type:'pushSubscribe',requestId:`enable-${suffix}`,subscription:await subscription(suffix)});
  assert.equal(pushStatus(room.push,socket.attachment.clientId).enabled,true);
  return ownerSecret;
}

test('private push identity and VAPID keys persist without appearing in any public snapshot', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  const ownerSecret = await enablePush(room,ctx.sockets[1]);
  const stored = clone(ctx.stored.get(PUSH_STORE_KEY));
  const keys = clone(ctx.stored.get(VAPID_KEY_STORAGE_KEY));
  assert(stored.owners[IDS[1]].secretHash); assert(keys.privateJwk.d);
  assert(!JSON.stringify(stored).includes(ownerSecret),'only the digest is durable');
  const publicJson = JSON.stringify(await readState(room));
  for (const privateValue of [ownerSecret,stored.owners[IDS[1]].secretHash,keys.privateJwk.d,
    stored.subscriptions[IDS[1]].subscription.endpoint,stored.subscriptions[IDS[1]].subscription.keys.auth]) {
    assert(!publicJson.includes(privateValue));
  }
  const restored = new HangmanRoom(ctx,{}); await restored.ready;
  await send(restored,ctx.sockets[1],{type:'pushStatus',requestId:'restore'});
  const reply = ctx.sockets[1].messages.at(-1);
  assert.equal(reply.type,'push'); assert.equal(reply.enabled,true); assert.equal(reply.publicKey,keys.publicKey);
  assert.equal(ctx.sockets[0].messages.some(message=>message.requestId==='restore'),false);
});

test('a public player ID and a stale authorization flag cannot disable another device’s push', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  await enablePush(room,ctx.sockets[1]);
  const impostor = await pendingSocket(ctx,room);
  await send(room,impostor,{type:'join',clientId:IDS[1],name:'Same public ID',ownerSecret:secret()});
  assert.equal(impostor.attachment.pushAuthorized,false);
  await send(room,impostor,{type:'pushUnsubscribe',requestId:'wrong-owner'});
  assert.equal(pushStatus(room.push,IDS[1]).enabled,true);
  assert.equal(impostor.messages.at(-1).status,'failed');
  impostor.attachment.pushAuthorized = true;
  impostor.attachment.pushOwnerHash = 'obsolete-owner-hash';
  await send(room,impostor,{type:'pushUnsubscribe',requestId:'stale-owner'});
  assert.equal(pushStatus(room.push,IDS[1]).enabled,true);
});

test('game and turn-notification outbox commit together before publication; a failed write rolls both back', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  await enablePush(room,ctx.sockets[1]);
  const beforeGame = clone(room.game), beforePush = clone(room.push);
  const request = action(room.game,'guess',{letter:'P'});
  ctx.sockets.forEach(socket=>{socket.messages=[];});
  const originalPut = ctx.storage.put;
  ctx.storage.put = async (key,value) => {
    if (key === PUSH_STORE_KEY) throw new Error('outbox durable write failed');
    await originalPut(key,value);
  };
  await send(room,ctx.sockets[0],request);
  assert.deepEqual(room.game,beforeGame); assert.deepEqual(room.push,beforePush);
  assert.deepEqual(ctx.stored.get(STORAGE_KEY),beforeGame);
  assert.deepEqual(ctx.stored.get(PUSH_STORE_KEY),beforePush);
  assert.equal(ctx.sockets[1].messages.length,0);
  ctx.storage.put = originalPut;
  await send(room,ctx.sockets[0],request);
  assert.equal(room.game.guesses.length,1);
  const job = room.push.outbox.find(job=>job.kind==='turn');
  assert(job); assert.equal(job.turnToken,room.game.turn.token);
  assert.equal(ctx.stored.get(PUSH_STORE_KEY).outbox[0].id,job.id);
  assert.equal(ctx.sockets[1].messages.at(-1).state.turn.activePlayerId,IDS[1]);
});

test('a slow or failed notification never blocks the next guess or rolls it back', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  await enablePush(room,ctx.sockets[1]);
  await send(room,ctx.sockets[0],action(room.game,'guess',{letter:'P'}));
  let release, started;
  const gate = new Promise(resolve=>{release=resolve;});
  const began = new Promise(resolve=>{started=resolve;});
  room.deliverPush = async task => {
    assert.equal(ctx.stored.get(PUSH_STORE_KEY).outbox.find(job=>job.id===task.id).attempts,1);
    started(); await gate;
    return {ok:false,expired:false,retryable:true,status:503,retryAfterMs:5000};
  };
  const delivery = room.flushPush(); await began;
  await send(room,ctx.sockets[1],action(room.game,'guess',{letter:'A'}));
  assert.equal(room.game.guesses.length,2);
  assert.equal(activeId(room.game),IDS[0]);
  release(); await delivery;
  assert.equal(room.game.guesses.length,2);
  assert.equal(room.push.outbox.length,0,'obsolete turn is cancelled before retry');
  assert.equal(room.game.strikes,0);
});

test('room alarms combine push retries and player grace without resending a completed turn', async () => {
  const originalNow = Date.now; let now = 300_000; Date.now = ()=>now;
  try {
    const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
    await enablePush(room,ctx.sockets[1]);
    await send(room,ctx.sockets[0],action(room.game,'guess',{letter:'P'}));
    let calls = 0;
    room.deliverPush = async () => ++calls === 1
      ? {ok:false,expired:false,retryable:true,status:503,retryAfterMs:5000}
      : {ok:true,expired:false,retryable:false,status:201};
    await room.flushPush();
    assert.equal(calls,1); assert.equal(await ctx.storage.getAlarm(),now+5000);
    now +=5000; await room.alarm();
    assert.equal(calls,2); assert.equal(room.push.outbox.length,0);
    await room.commit(room.game); await room.flushPush();
    assert.equal(calls,2,'a saved turn token deduplicates future reads and restarts');
    await room.webSocketClose(ctx.sockets[0],1000);
    assert.equal(await ctx.storage.getAlarm(),now+RECONNECT_GRACE_MS);
  } finally { Date.now = originalNow; }
});

test('explicit leave acknowledges every duplicate tab only after durable success', async () => {
  const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
  const duplicate = await pendingSocket(ctx,room);
  await send(room,duplicate,{type:'join',clientId:IDS[0],name:'Alex'});
  const request = action(room.game,'leave');
  const originalPut = ctx.storage.put;
  ctx.storage.put = async()=>{throw new Error('save failed');};
  await send(room,ctx.sockets[0],request);
  assert.equal(ctx.sockets[0].readyState,1); assert.equal(duplicate.readyState,1);
  assert.equal(ctx.sockets[0].messages.some(message=>message.type==='left'),false);
  ctx.storage.put = originalPut;
  await send(room,ctx.sockets[0],request);
  for (const socket of [ctx.sockets[0],duplicate]) {
    assert.equal(socket.messages.at(-1).type,'left'); assert.equal(socket.closeCode,1000);
  }
  assert.equal(room.game.turn.order.some(player=>player.id===IDS[0]),false);
  assert.equal(activeId(room.game),IDS[1]);
});

test('a connected waiting newcomer cannot be stranded behind one remaining offline push player', () => {
  let game = fixture(['Sam','Alex']);
  game = updatePushPreference(game,IDS[1],true,{now:1000}).state;
  game = guess(game,'P').state; // Alex's turn, after Sam started the cycle.
  game = addPlayer(game,IDS[2],'Casey');
  game = applyAction(game,action(game,'leave'),{playerId:IDS[0],now:3000}).state;
  const online = new Set([IDS[2]]);
  game = refreshPlayers(game,online,{now:4000}).state;
  assert.equal(activeId(game),IDS[1]);
  assert.equal(game.turn.order.length,1); assert.equal(game.turn.waiting.length,1);
  assert(game.turn.deadlineAt >4000 && game.turn.deadlineAt <=4000+VOTE_FALLBACK_MS);
  game = refreshPlayers(game,online,{now:game.turn.deadlineAt}).state;
  assert.equal(game.turn.waiting.length,0);
  assert(game.turn.order.some(player=>player.id===IDS[2]));
  game = refreshPlayers(game,online,{now:game.turn.deadlineAt}).state;
  assert.equal(activeId(game),IDS[2]);
  assert.equal(game.strikes,0);
});

test('an additional due notification cannot spin immediate alarms while a delivery is in flight', async () => {
  const originalNow = Date.now; const now = 400_000; Date.now = ()=>now;
  try {
    const ctx = roomContext(); const room = new HangmanRoom(ctx,{}); await room.ready;
    await enablePush(room,ctx.sockets[1]);
    await send(room,ctx.sockets[0],action(room.game,'guess',{letter:'P'}));
    assert.equal(await ctx.storage.getAlarm(),now);
    room.dispatching = true;
    await room.commit(room.game);
    assert.equal(await ctx.storage.getAlarm(),now+1000);
    room.dispatching = false;
  } finally { Date.now = originalNow; }
});

// Multiword answers ignore spaces, preserve turn gating, and reset clues between rounds.
test('phrase rounds reveal separators, count only letters and solve with ten-strike rules', () => {
  let game = addPlayer(createGame({ settings: { ...DEFAULT_SETTINGS, puzzleMode: 'phrase' }, random: () => 0 }), IDS[0], 'wise panda of the enchanted forest');
  assert.match(game.word, / /); assert(game.word.length > 5);
  assertStoredGame(game);
  const snapshot = publicState(game);
  assert.equal(snapshot.mask.filter(ch => ch === ' ').length, game.word.split(' ').length - 1);
  assert.equal(snapshot.answer, null);
  const spaceIndices = [...game.word].flatMap((c,i) => c === ' ' ? [i] : []);
  for (const i of spaceIndices) assert.equal(snapshot.mask[i], ' ');
  const hint = applyAction(game,action(game,'hint'),{playerId:IDS[0]});
  assert.equal(hint.state.clueShown,true);
  game = hint.state;
  for (const letter of new Set(game.word.toUpperCase().replaceAll(' ',''))) game = guess(game,letter).state;
  assert.equal(game.status,'won'); assert.equal(game.wins,1);
  game = applyAction(game,action(game,'next'),{playerId:IDS[0],random:()=>0}).state;
  assert.equal(game.clueShown,false);
  assert.equal(game.clueEnabled,false);
  assert.equal(publicState(game).clue,null);
});
