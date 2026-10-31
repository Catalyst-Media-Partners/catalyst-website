import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAction, assertStoredGame, createGame, joinPlayer, migrateGame, publicState, refreshPlayers, reserveEntry, WORD_BANK } from '../src/privategames/game.mjs';
import { nextAlarmAt, RECONNECT_GRACE_MS } from '../src/privategames/turns.mjs';
import { HangmanRoom, STORAGE_KEY } from '../src/privategames/room.js';

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

test('a clicked clue stays open across words without advancing anyone’s turn', () => {
  let game = fixture(['Alex','Sam']);
  const turnBefore = clone(game.turn);
  game = applyAction(game, action(game, 'hint'), { playerId: IDS[1] }).state;
  assert.equal(game.clueEnabled, true);
  assert.deepEqual(game.turn, turnBefore);
  game = applyAction(game, action(game, 'next', { skip: true }), { playerId: IDS[0] }).state;
  assert.equal(game.clueShown, true);
  assert.equal(publicState(game).clue, game.clue);
  assert.equal(game.turn.cursor, 0);
  assert.equal(applyAction(game, action(game, 'hint'), { playerId: IDS[1] }).changed, false);
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
  assert.equal(migrated.schemaVersion, 2);
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

test('100 word transitions preserve shuffled-cycle uniqueness and no immediate repeats', () => {
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
  assert.deepEqual(after,before);
  assert.equal(after.state.wins,1);
  assert.equal(after.state.roundNumber,2);
  assert.equal(after.state.clueShown,true);
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
  assert.equal(await ctx.storage.getAlarm(),null);
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
  await room.webSocketMessage(ctx.sockets[0],'x'.repeat(2049));
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
