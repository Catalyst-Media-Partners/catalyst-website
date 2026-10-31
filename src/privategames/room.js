import { applyAction, createGame, joinPlayer, migrateGame, publicState, refreshPlayers, reserveEntry, updatePushPreference } from './game.mjs';
import { getVocabularyMetadata } from './dictionary.mjs';
import { getPhraseMetadata } from './phrases.mjs';
import { nextAlarmAt } from './turns.mjs';
import { ensurePushAuthorization, ensurePushKeys, sendWebPush } from './push.mjs';
import { claimDevice, claimDueTasks, completeTask, loadPushStore, nextRetryAt, pruneTurnJobs,
  pushStatus, queueTest, queueTurn, savePushStore, subscribe, unsubscribe } from './push-store.mjs';

export const STORAGE_KEY = 'hangman-state-v1';
const MAX_CONNECTIONS = 64;
const MAX_MESSAGE_BYTES = 8192;
const RATE_WINDOW_MS = 5000;
const MAX_MESSAGES_PER_WINDOW = 40;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ERROR_MESSAGES = {
  invalid_action: 'Choose a letter, pass, vote, reveal a clue, or start another word.',
  invalid_letter: 'Choose one letter from A to Z.',
  invalid_message: 'That game message could not be read.',
  invalid_join: 'Please use a name of up to 64 characters.',
  invalid_settings: 'Choose an available vocabulary and a length range from 3 to 15 letters.',
  round_in_progress: 'Finish the current word or confirm skipping it for everyone.',
  stale_round: 'The room has moved to a new word. Your screen has been refreshed.',
  round_complete: 'This round has ended. Start another word to keep playing.',
  rate_limited: 'Too many actions at once. Wait a moment and try again.',
  save_failed: 'That move could not be saved. Please try it again.',
  client_update_required: 'Game updated. Refresh this page to use the turn order.',
  join_required: 'Join the room before taking a turn.',
  identity_locked: 'This connection has already joined. Refresh to reconnect.',
  waiting_for_cycle: 'You will join when the current round of players finishes.',
  out_of_turn: 'Please wait for your highlighted turn.',
  stale_turn: 'The turn has changed. Your screen has been refreshed.',
  room_full: 'The room has 64 players. Please wait a moment before joining.',
  vote_disabled: 'This game uses the turn timer. The current player can also pass.',
  vote_own_turn: 'Use Pass to end your own turn.',
  vote_ineligible: 'You are not eligible to vote on this turn.',
  not_enough_voters: 'Skipping needs at least two votes. This turn has a 90-second fallback timer.',
};

const json = (value, status = 200) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
const equalJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function cleanName(value) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ').trim();
  if ([...name].length > 64) return null;
  return name || 'Guest';
}

// Hibernating sockets retain their identity and private push authorization in
// attachments. The game, private outbox and their one alarm commit together.
export class HangmanRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.game = null;
    this.push = null;
    this.pushKeys = null;
    this.dispatching = false;
    this.queue = Promise.resolve();
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get(STORAGE_KEY);
      this.push = await loadPushStore(ctx.storage);
      let next = stored === undefined ? createGame() : migrateGame(stored);
      let changed = next !== stored;
      // Old, already-open sockets have no historical entry timestamp. Keep their
      // deterministic connected order without replacing the live game record.
      for (const socket of this.sockets()) {
        const info = socket.deserializeAttachment();
        if (!info || info.joined === false || !UUID.test(info.clientId || '')) continue;
        const id = info.clientId.toLowerCase();
        const name = cleanName(info.name) || 'Guest';
        const member = [...next.turn.order, ...next.turn.waiting].find(player => player.id === id);
        if (!member) { next = reserveEntry(next); changed = true; }
        const entryOrder = member?.entryOrder || next.turn.nextEntry;
        const joined = joinPlayer(next, { id, name, entryOrder, pushEnabled: pushStatus(this.push, id).enabled },
          { connectedIds: this.connectedIds(), activity: false });
        next = joined.state;
        changed = changed || joined.changed;
        socket.serializeAttachment({ ...info, clientId: id, name, entryOrder, joined: true,
          pushAuthorized: info.pushAuthorized === true && Boolean(this.push.owners[id]) &&
            info.pushOwnerHash === this.push.owners[id].secretHash });
      }
      const refreshed = refreshPlayers(next, this.connectedIds());
      next = refreshed.state;
      changed = changed || refreshed.changed;
      const savedPush = await this.persist(next, changed);
      this.game = next;
      this.push = savedPush;
    });
    if (typeof WebSocketRequestResponsePair !== 'undefined') {
      ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    }
  }

  // Reads, writes and presence changes share one queue. External push delivery
  // runs outside it, so a slow push provider cannot block anyone's guess.
  serial(operation) {
    const result = this.queue.then(async () => { await this.ready; return operation(); });
    this.queue = result.catch(() => {});
    return result;
  }

  sockets() {
    return this.ctx.getWebSockets().filter(socket => socket.readyState === 1 && !socket.deserializeAttachment()?.closed);
  }

  connectedIds() {
    return new Set(this.sockets().filter(socket => socket.deserializeAttachment()?.joined === true)
      .map(socket => socket.deserializeAttachment().clientId));
  }

  preparePush(next, store, now = Date.now()) {
    const current = next.turn.order[next.turn.cursor];
    let prepared = pruneTurnJobs(store, { turnToken: next.turn.token, paused: next.turn.paused,
      activePlayerId: current?.id || null }, now);
    if (!next.turn.paused && current?.pushEnabled && next.turn.order.length + next.turn.waiting.length >= 2) {
      const expiry = Math.min(next.turn.deadlineAt ?? now + 90_000, now + 90_000);
      prepared = queueTurn(prepared, { turnToken: next.turn.token, playerId: current.id, expiresAt: expiry,
        payload: { title: 'Your Hangman turn',
          body: next.status === 'playing' ? `${current.name}, choose a letter in the shared game.` : `${current.name}, start the next word for everyone.`,
          kind: 'turn', roundId: next.roundId, url: '/privategames/', tag: 'hangman-turn' },
      }, now);
    }
    return equalJson(prepared, store) ? store : prepared;
  }

  async persist(next, writeState = true, candidatePush = this.push, { prepare = true } = {}) {
    const storage = this.ctx.storage;
    const savedPush = prepare ? this.preparePush(next, candidatePush) : candidatePush;
    const retry = nextRetryAt(savedPush);
    // Another job can become due during a network request. Avoid repeatedly
    // waking an immediate alarm while the current delivery owns the dispatcher.
    const pushDeadline = this.dispatching && retry !== null && retry <= Date.now() ? Date.now() + 1000 : retry;
    const deadlines = [nextAlarmAt(next.turn), pushDeadline].filter(value => value !== null);
    const deadline = deadlines.length ? Math.min(...deadlines) : null;
    await storage.transaction(async () => {
      if (writeState) await storage.put(STORAGE_KEY, next);
      if (!equalJson(savedPush, this.push)) await savePushStore(storage, savedPush);
      const currentAlarm = await storage.getAlarm();
      if (deadline !== currentAlarm) {
        if (deadline === null) await storage.deleteAlarm();
        else await storage.setAlarm(deadline);
      }
    });
    return savedPush;
  }

  async commit(next, candidatePush = this.push, options) {
    const savedPush = await this.persist(next, next !== this.game, candidatePush, options);
    this.game = next;
    this.push = savedPush;
    this.dispatchSoon();
  }

  dispatchSoon() {
    if (this.dispatching || !this.ctx.waitUntil || nextRetryAt(this.push) === null || nextRetryAt(this.push) > Date.now()) return;
    this.ctx.waitUntil(this.flushPush().catch(() => this.ensureRecoveryAlarm()));
  }

  async keys() {
    if (!this.pushKeys) this.pushKeys = await ensurePushKeys(this.ctx.storage);
    return this.pushKeys;
  }

  async deliverPush(task) {
    const { keys, authorization, valid } = await this.serial(async () => {
      const keys = await this.keys();
      const authorization = await ensurePushAuthorization(this.ctx.storage, keys, task.subscription.endpoint);
      // Key generation/signing can yield. Recheck the job before network I/O.
      return { keys, authorization,
        valid: this.push.outbox.some(job => job.id === task.id && job.attempts === task.attempts) };
    });
    if (!valid || task.expiresAt <= Date.now()) return { ok: false, retryable: false, expired: false, status: 0 };
    return sendWebPush(task.subscription, task.payload, keys, {
      authorization, topic: task.topic, ttl: Math.max(0, Math.floor((task.expiresAt - Date.now()) / 1000)),
    });
  }

  async flushPush() {
    if (this.dispatching) return;
    this.dispatching = true;
    let completed = false;
    try {
      const tasks = await this.serial(async () => {
        await this.refreshConnections();
        const prepared = this.preparePush(this.game, this.push);
        const claimed = claimDueTasks(prepared, Date.now());
        await this.commit(this.game, claimed.store, { prepare: false });
        return claimed.tasks;
      });
      await Promise.all(tasks.map(async task => {
        let result;
        try { result = await this.deliverPush(task); }
        catch { result = { ok: false, expired: false, retryable: true, status: 0, retryAfterMs: 5000 }; }
        await this.serial(async () => {
          const store = completeTask(this.push, task.id, result, Date.now(), task.attempts);
          const preference = updatePushPreference(this.game, task.playerId, pushStatus(store, task.playerId).enabled);
          const refreshed = refreshPlayers(preference.state, this.connectedIds());
          await this.commit(refreshed.state, store);
          if (preference.changed || refreshed.changed) this.broadcast();
          this.sendPrivatePushStatus(task.playerId);
        });
      }));
      completed = true;
    } finally { this.dispatching = false; if (completed) this.dispatchSoon(); }
  }

  async refreshConnections() {
    const result = refreshPlayers(this.game, this.connectedIds());
    if (result.changed) { await this.commit(result.state); this.broadcast(); }
    return result.changed;
  }

  async ensureRecoveryAlarm() {
    const retryAt = Date.now() + 1000;
    const existing = await this.ctx.storage.getAlarm();
    if (existing === null || existing > retryAt) await this.ctx.storage.setAlarm(retryAt);
  }

  envelope() {
    const players = new Map();
    for (const socket of this.sockets()) {
      const attachment = socket.deserializeAttachment();
      if (attachment?.joined) players.set(attachment.clientId, { id: attachment.clientId, name: attachment.name });
    }
    return { type: 'state', state: publicState(this.game, this.connectedIds()), players: [...players.values()],
      catalog: { ...getVocabularyMetadata(), phrases: getPhraseMetadata() }, serverTime: Date.now() };
  }

  send(socket, value) {
    if (socket.readyState !== 1 || socket.deserializeAttachment()?.closed) return;
    try { socket.send(typeof value === 'string' ? value : JSON.stringify(value)); }
    catch {
      this.markClosed(socket);
      try { socket.close(1011, 'Please reconnect'); } catch {}
      if (this.ctx.waitUntil) this.ctx.waitUntil(this.serial(() => this.refreshConnections()).catch(() => this.ensureRecoveryAlarm()));
    }
  }

  broadcast() {
    const message = JSON.stringify(this.envelope());
    for (const socket of this.sockets()) this.send(socket, message);
  }

  error(socket, code) { this.send(socket, { type: 'error', code, message: ERROR_MESSAGES[code] || ERROR_MESSAGES.invalid_message }); }
  markClosed(socket) {
    const attachment = socket.deserializeAttachment();
    if (attachment) socket.serializeAttachment({ ...attachment, closed: true });
  }

  sendPrivatePushStatus(playerId, requestId = null, socket = null, error = null) {
    const status = pushStatus(this.push, playerId);
    const reply = { type: 'push', requestId, ...status, publicKey: this.pushKeys?.publicKey || null,
      ...(error ? { error, status: 'failed' } : {}) };
    if (socket) this.send(socket, reply);
    else for (const candidate of this.sockets()) {
      const info = candidate.deserializeAttachment();
      if (info.joined && info.pushAuthorized && info.pushOwnerHash === this.push.owners[playerId]?.secretHash &&
        info.clientId === playerId) this.send(candidate, reply);
    }
  }

  async pushAction(socket, action, attachment, now) {
    const requestId = typeof action.requestId === 'string' && action.requestId.length <= 100 ? action.requestId : null;
    if (!requestId || !attachment.joined || !attachment.pushAuthorized || !this.push.owners[attachment.clientId] ||
      attachment.pushOwnerHash !== this.push.owners[attachment.clientId]?.secretHash) {
      this.send(socket, { type: 'push', requestId, enabled: false, publicKey: null, status: 'failed',
        error: 'Reconnect with this device before changing notifications.' });
      return;
    }
    try {
      let store = this.push;
      if (action.type === 'pushUnsubscribe') store = unsubscribe(store, attachment.clientId);
      else {
        await this.keys();
        if (action.type === 'pushSubscribe') store = await subscribe(store, attachment.clientId, action.subscription, now);
        else if (action.type === 'pushTest') store = queueTest(store, { playerId: attachment.clientId,
          payload: { title: 'Hangman notifications are ready', body: 'You will hear when it is your turn.',
            kind: 'test', roundId: this.game.roundId, turnToken: this.game.turn.token, url: '/privategames/', tag: 'hangman-test' } }, now);
        else if (action.type !== 'pushStatus') throw new Error('Unknown notification action.');
      }
      const preference = updatePushPreference(this.game, attachment.clientId, pushStatus(store, attachment.clientId).enabled,
        { now, connectedIds: this.connectedIds() });
      await this.commit(preference.state, store);
      if (preference.changed) this.broadcast();
      this.sendPrivatePushStatus(attachment.clientId, requestId, socket);
    } catch (error) {
      this.sendPrivatePushStatus(attachment.clientId, requestId, socket,
        error?.name === 'PushError' ? error.message : 'Notifications could not be saved. Try again.');
    }
  }

  async fetch(request) {
    try {
      return await this.serial(async () => {
        const url = new URL(request.url);
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        if (url.pathname.endsWith('/state')) { await this.refreshConnections(); return json(this.envelope()); }
        if (!url.pathname.endsWith('/socket')) return json({ error: 'Not found' }, 404);
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket upgrade required' }, 426);
        if (request.headers.get('Origin') !== url.origin) return json({ error: 'Connect from this website' }, 403);
        if (this.sockets().length >= MAX_CONNECTIONS) return json({ error: 'The room is full. Please try again later.' }, 503);
        await this.refreshConnections();
        await this.commit(reserveEntry(this.game));
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        const connectionId = globalThis.crypto.randomUUID();
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({ connectionId, clientId: connectionId, name: 'Guest', closed: false,
          joined: false, pushAuthorized: false, entryOrder: this.game.turn.nextEntry, rateStart: Date.now(), rateCount: 0 });
        this.broadcast();
        return new Response(null, { status: 101, webSocket: client });
      });
    } catch { return json({ error: 'The saved game is temporarily unavailable. Please reconnect.' }, 503); }
  }

  async webSocketMessage(socket, raw) {
    if (raw === 'ping') { this.send(socket, 'pong'); return; }
    try {
      await this.serial(async () => {
        const attachment = socket.deserializeAttachment();
        if (!attachment || attachment.closed || socket.readyState !== 1) return;
        if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) {
          this.error(socket, 'invalid_message'); this.markClosed(socket); socket.close(1009, 'Message too large or unsupported');
          await this.refreshConnections(); return;
        }
        const now = Date.now();
        if (now - attachment.rateStart >= RATE_WINDOW_MS) { attachment.rateStart = now; attachment.rateCount = 0; }
        attachment.rateCount++; socket.serializeAttachment(attachment);
        if (attachment.rateCount > MAX_MESSAGES_PER_WINDOW) { this.error(socket, 'rate_limited'); return; }
        let action;
        try { action = JSON.parse(raw); } catch { this.error(socket, 'invalid_message'); return; }
        if (!action || typeof action !== 'object' || Array.isArray(action)) { this.error(socket, 'invalid_message'); return; }
        if (action.type === 'join') {
          const name = cleanName(action.name);
          if (typeof action.clientId !== 'string' || !UUID.test(action.clientId) || name === null) { this.error(socket, 'invalid_join'); return; }
          const id = action.clientId.toLowerCase();
          if (attachment.joined && attachment.clientId !== id) { this.error(socket, 'identity_locked'); return; }
          let store = this.push;
          let authorized = attachment.joined && attachment.clientId === id && attachment.pushAuthorized === true &&
            attachment.pushOwnerHash === this.push.owners[id]?.secretHash;
          let ownershipError = null;
          if (action.ownerSecret !== undefined) {
            try { store = await claimDevice(store, id, action.ownerSecret, now); authorized = true; }
            catch (error) { authorized = false; ownershipError = error?.message || 'This device could not enable notifications.'; }
          }
          const connected = this.connectedIds();
          const refreshed = refreshPlayers(this.game, connected, { now });
          const joined = joinPlayer(refreshed.state, { id, name, entryOrder: attachment.entryOrder,
            pushEnabled: pushStatus(store, id).enabled }, { now, connectedIds: connected });
          if (joined.code) { this.error(socket, joined.code); return; }
          await this.commit(joined.state, store);
          attachment.clientId = id; attachment.name = name; attachment.joined = true; attachment.pushAuthorized = authorized;
          attachment.pushOwnerHash = authorized ? store.owners[id]?.secretHash : null;
          attachment.entryOrder = [...this.game.turn.order, ...this.game.turn.waiting].find(player => player.id === id).entryOrder;
          socket.serializeAttachment(attachment);
          for (const other of this.sockets()) {
            const info = other.deserializeAttachment();
            if (info.joined && info.clientId === id) other.serializeAttachment({ ...info, name });
          }
          this.broadcast();
          if (ownershipError) this.sendPrivatePushStatus(id, null, socket, ownershipError);
          return;
        }
        if (['pushStatus', 'pushSubscribe', 'pushUnsubscribe', 'pushTest'].includes(action.type)) {
          await this.pushAction(socket, action, attachment, now); return;
        }
        await this.refreshConnections();
        const result = applyAction(this.game, action, { playerId: attachment.joined ? attachment.clientId : null,
          now, connectedIds: this.connectedIds() });
        if (!result.changed) {
          if (result.code) this.error(socket, result.code);
          this.send(socket, this.envelope()); return;
        }
        try { await this.commit(result.state); }
        catch { this.error(socket, 'save_failed'); this.send(socket, this.envelope()); return; }
        if (result.left) {
          for (const other of this.sockets()) {
            if (other.deserializeAttachment()?.clientId !== attachment.clientId) continue;
            this.send(other, { type: 'left' }); this.markClosed(other);
            try { other.close(1000, 'Left room'); } catch {}
          }
        }
        this.broadcast();
      });
    } catch {
      if (socket.deserializeAttachment()?.closed) await this.ensureRecoveryAlarm();
      this.error(socket, 'save_failed');
    }
  }

  async webSocketClose(socket, code) {
    try {
      await this.serial(async () => {
        this.markClosed(socket);
        try { socket.close(code === 1000 || code === 1001 ? code : 1000, 'Disconnected'); } catch {}
        await this.refreshConnections();
      });
    } catch { await this.ensureRecoveryAlarm(); }
  }

  async webSocketError(socket) {
    try {
      await this.serial(async () => {
        this.markClosed(socket);
        try { socket.close(1011, 'Please reconnect'); } catch {}
        await this.refreshConnections();
      });
    } catch { await this.ensureRecoveryAlarm(); }
  }

  async alarm() {
    await this.serial(async () => {
      const changed = await this.refreshConnections();
      if (!changed) await this.commit(this.game);
    });
    await this.flushPush();
  }
}
