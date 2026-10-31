import { applyAction, assertStoredGame, createGame, publicState } from './game.mjs';

export const STORAGE_KEY = 'hangman-state-v1';
const MAX_CONNECTIONS = 64;
const MAX_MESSAGE_BYTES = 2048;
const RATE_WINDOW_MS = 5000;
const MAX_MESSAGES_PER_WINDOW = 40;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const ERROR_MESSAGES = {
  invalid_action: 'Choose a letter, reveal a clue, or start another word.',
  invalid_letter: 'Choose one letter from A to Z.',
  invalid_message: 'That game message could not be read.',
  invalid_join: 'Please use a name of up to 24 characters.',
  round_in_progress: 'Finish the current word or confirm skipping it for everyone.',
  stale_round: 'The room has moved to a new word. Your screen has been refreshed.',
  round_complete: 'This round has ended. Start another word to keep playing.',
  rate_limited: 'Too many actions at once. Wait a moment and try again.',
  save_failed: 'That move could not be saved. Please try it again.',
};

const json = (value, status = 200) => Response.json(value, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

function cleanName(value) {
  if (typeof value !== 'string') return null;
  const name = value.normalize('NFC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\s+/g, ' ').trim();
  if ([...name].length > 24) return null;
  return name || 'Guest';
}

// A plain Durable Object class needs only ctx and its event handlers; there is
// no RPC API or platform module import, which also keeps the storage tests real.
export class HangmanRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.game = null;
    this.queue = Promise.resolve();
    this.ready = ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get(STORAGE_KEY);
      if (stored !== undefined) {
        this.game = assertStoredGame(stored);
      } else {
        const initial = createGame();
        await ctx.storage.put(STORAGE_KEY, initial);
        this.game = initial;
      }
    });
    if (typeof WebSocketRequestResponsePair !== 'undefined') {
      ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    }
  }

  // Reads, writes, and presence changes all use the same queue. A pending
  // durable write can never be overtaken by a reconnect or a second guess.
  serial(operation) {
    const result = this.queue.then(async () => {
      await this.ready;
      return operation();
    });
    this.queue = result.catch(() => {});
    return result;
  }

  sockets() {
    return this.ctx.getWebSockets().filter(socket =>
      socket.readyState === 1 && !socket.deserializeAttachment()?.closed);
  }

  envelope() {
    const players = new Map();
    for (const socket of this.sockets()) {
      const attachment = socket.deserializeAttachment();
      if (attachment) players.set(attachment.clientId, { id: attachment.clientId, name: attachment.name });
    }
    return { type: 'state', state: publicState(this.game), players: [...players.values()] };
  }

  send(socket, value) {
    if (socket.readyState !== 1 || socket.deserializeAttachment()?.closed) return;
    try {
      socket.send(typeof value === 'string' ? value : JSON.stringify(value));
    } catch {
      this.markClosed(socket);
      try { socket.close(1011, 'Please reconnect'); } catch {}
    }
  }

  broadcast() {
    const message = JSON.stringify(this.envelope());
    for (const socket of this.sockets()) this.send(socket, message);
  }

  error(socket, code) {
    this.send(socket, { type: 'error', code, message: ERROR_MESSAGES[code] || ERROR_MESSAGES.invalid_message });
  }

  markClosed(socket) {
    const attachment = socket.deserializeAttachment();
    if (attachment) socket.serializeAttachment({ ...attachment, closed: true });
  }

  async fetch(request) {
    try {
      return await this.serial(() => {
        const url = new URL(request.url);
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        if (url.pathname.endsWith('/state')) return json(this.envelope());
        if (!url.pathname.endsWith('/socket')) return json({ error: 'Not found' }, 404);
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
          return json({ error: 'WebSocket upgrade required' }, 426);
        }
        if (request.headers.get('Origin') !== url.origin) {
          return json({ error: 'Connect from this website' }, 403);
        }
        if (this.sockets().length >= MAX_CONNECTIONS) {
          return json({ error: 'The room is full. Please try again later.' }, 503);
        }
        const pair = new WebSocketPair();
        const [client, server] = Object.values(pair);
        const connectionId = globalThis.crypto.randomUUID();
        this.ctx.acceptWebSocket(server);
        server.serializeAttachment({
          connectionId, clientId: connectionId, name: 'Guest', closed: false,
          rateStart: Date.now(), rateCount: 0,
        });
        this.broadcast();
        return new Response(null, { status: 101, webSocket: client });
      });
    } catch {
      return json({ error: 'The saved game is temporarily unavailable. Please reconnect.' }, 503);
    }
  }

  async webSocketMessage(socket, raw) {
    if (raw === 'ping') {
      this.send(socket, 'pong');
      return;
    }
    try {
      await this.serial(async () => {
        const attachment = socket.deserializeAttachment();
        if (!attachment || attachment.closed || socket.readyState !== 1) return;
        if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES ||
          new TextEncoder().encode(raw).byteLength > MAX_MESSAGE_BYTES) {
          this.error(socket, 'invalid_message');
          this.markClosed(socket);
          socket.close(1009, 'Message too large or unsupported');
          this.broadcast();
          return;
        }
        const now = Date.now();
        if (now - attachment.rateStart >= RATE_WINDOW_MS) {
          attachment.rateStart = now;
          attachment.rateCount = 0;
        }
        attachment.rateCount++;
        socket.serializeAttachment(attachment);
        if (attachment.rateCount > MAX_MESSAGES_PER_WINDOW) {
          this.error(socket, 'rate_limited');
          return;
        }
        let action;
        try { action = JSON.parse(raw); } catch {
          this.error(socket, 'invalid_message');
          return;
        }
        if (!action || typeof action !== 'object' || Array.isArray(action)) {
          this.error(socket, 'invalid_message');
          return;
        }
        if (action.type === 'join') {
          const name = cleanName(action.name);
          if (typeof action.clientId !== 'string' || !UUID.test(action.clientId) || name === null) {
            this.error(socket, 'invalid_join');
            return;
          }
          attachment.clientId = action.clientId.toLowerCase();
          attachment.name = name;
          socket.serializeAttachment(attachment);
          // Tabs on the same device count as one player and share its name.
          for (const other of this.sockets()) {
            const info = other.deserializeAttachment();
            if (info.clientId === attachment.clientId) {
              other.serializeAttachment({ ...info, name });
            }
          }
          this.broadcast();
          return;
        }
        const result = applyAction(this.game, action, { player: attachment.name, now });
        if (!result.changed) {
          if (result.code) this.error(socket, result.code);
          this.send(socket, this.envelope());
          return;
        }
        try {
          await this.ctx.storage.put(STORAGE_KEY, result.state);
        } catch {
          this.error(socket, 'save_failed');
          this.send(socket, this.envelope());
          return;
        }
        this.game = result.state;
        this.broadcast();
      });
    } catch {
      this.error(socket, 'save_failed');
    }
  }

  async webSocketClose(socket, code) {
    await this.serial(() => {
      this.markClosed(socket);
      try { socket.close(code === 1000 || code === 1001 ? code : 1000, 'Disconnected'); } catch {}
      this.broadcast();
    });
  }

  async webSocketError(socket) {
    await this.serial(() => {
      this.markClosed(socket);
      try { socket.close(1011, 'Please reconnect'); } catch {}
      this.broadcast();
    });
  }
}
