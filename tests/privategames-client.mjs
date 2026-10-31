import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createECDH, webcrypto } from 'node:crypto';
import vm from 'node:vm';

// These mocks exercise opt-in, private-message lifecycle and navigation behavior.
// They do not claim to test OS notification delivery or mobile installation UI.
const source = name => readFileSync(new URL(`../privategames/${name}`, import.meta.url), 'utf8');
const notificationSource = source('notifications.js');
const workerSource = source('sw.js');
const origin = 'https://hangman.example';
const keyBytes = createECDH('prime256v1').generateKeys();
const publicKey = keyBytes.toString('base64url');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}

class Node {
  constructor(tagName = 'DIV') {
    this.tagName = tagName.toUpperCase(); this.listeners = new Map(); this.children = [];
    this.hidden = false; this.disabled = false; this.textContent = ''; this._value = '';
    this.attributes = {}; this.className = ''; this.classes = new Set();
    this.classList = { toggle: (name, value) => value ? this.classes.add(name) : this.classes.delete(name) };
    this.style = { setProperty: (name, value) => { this.attributes[name] = value; } };
  }
  set value(value) { this._value = String(value); }
  get value() { return this._value; }
  addEventListener(type, fn) { const list = this.listeners.get(type) || []; list.push(fn); this.listeners.set(type, list); }
  removeEventListener(type, fn) { this.listeners.set(type, (this.listeners.get(type) || []).filter(item => item !== fn)); }
  async emit(type, event = {}) {
    if (type === 'click' && this.disabled) return;
    for (const listener of this.listeners.get(type) || []) await listener({ target: this, preventDefault() {}, ...event });
  }
  appendChild(node) { this.children.push(node); return node; }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  scrollIntoView() { this.scrolled = true; }
  focus() { this.focused = true; }
  closest() { return ['INPUT', 'TEXTAREA', 'SELECT'].includes(this.tagName) ? this : null; }
}

function dom() {
  const nodes = new Map();
  const get = id => { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); };
  const document = new Node();
  document.getElementById = get;
  document.createElement = name => new Node(name);
  document.querySelectorAll = selector => selector === '.drawing-part' ? Array.from({ length: 10 }, () => new Node('path')) : [];
  return { document, get };
}

function clock() {
  let counter = 0;
  const timers = new Map();
  return {
    timers,
    setTimeout(fn, delay) { const id = ++counter; timers.set(id, { fn, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return ++counter; },
    clearInterval() {},
  };
}

function notificationHarness(options = {}) {
  const { document, get } = dom();
  const storage = new Map(Object.entries(options.storage || {}));
  const calls = { permission: 0, register: 0, subscribe: 0, unsubscribe: [], sent: [], notices: [], posts: [] };
  const timers = clock();
  let currentSubscription = null;
  let subscriptionNumber = 0;
  const makeSubscription = endpoint => ({
    endpoint,
    options: { applicationServerKey: Uint8Array.from(keyBytes).buffer },
    toJSON() { return { endpoint: this.endpoint, keys: { auth: 'test-auth', p256dh: 'test-public-key' } }; },
    async unsubscribe() { calls.unsubscribe.push(this.endpoint); if (currentSubscription === this) currentSubscription = null; return true; },
  });
  if (options.existingSubscription) currentSubscription = makeSubscription(`${origin}/push/stale`);
  const registration = {
    active: { postMessage: message => calls.posts.push(message) },
    pushManager: {
      async getSubscription() { return currentSubscription; },
      async subscribe(settings) {
        calls.subscribe++;
        assert.equal(settings.userVisibleOnly, true);
        assert.deepEqual(Array.from(settings.applicationServerKey), Array.from(keyBytes));
        currentSubscription = makeSubscription(`${origin}/push/fresh-${++subscriptionNumber}`);
        return currentSubscription;
      },
    },
  };
  const Notification = {
    permission: options.permission || 'default',
    requestPermission() {
      calls.permission++;
      this.permission = options.permissionResponse || 'granted';
      return Promise.resolve(this.permission);
    },
  };
  const navigator = {
    userAgent: options.ios ? 'iPhone' : 'Test Browser', platform: options.ios ? 'iPhone' : 'Linux', maxTouchPoints: 0,
    serviceWorker: { async register(url, settings) {
      calls.register++;
      assert.match(url, /^\/privategames\/sw\.js(?:\?|$)/);
      assert.equal(settings.scope, '/privategames/');
      return registration;
    } },
  };
  const window = { isSecureContext: true, Notification, PushManager: function PushManager() {} };
  let client;
  let responder = options.autoReply === false ? null : message => ({
    type: 'push', requestId: message.requestId, publicKey,
    enabled: message.type === 'pushSubscribe' || (message.type === 'pushStatus' && options.serverEnabled === true),
    status: message.type === 'pushStatus' ? (options.serverStatus || 'idle') : message.type === 'pushTest' ? 'queued' : 'saved',
  });
  const context = vm.createContext({
    document, navigator, window, Notification, Uint8Array, crypto: webcrypto,
    atob: value => Buffer.from(value, 'base64').toString('binary'),
    matchMedia: () => ({ matches: options.standalone === true }),
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    ...timers,
    exports: {},
  });
  vm.runInContext(notificationSource.replace(/^export function /gm, 'function ') +
    '\nexports.createTurnNotifications=createTurnNotifications; exports.decodeApplicationKey=decodeApplicationKey;', context);
  client = context.exports.createTurnNotifications({
    send(message) {
      calls.sent.push(message);
      if (responder) queueMicrotask(() => client.message(responder(message)));
    },
    notice: message => calls.notices.push(message),
  });
  return { client, calls, get, storage, timers, registration, decode: context.exports.decodeApplicationKey,
    setResponder(value) { responder = value; } };
}

function workerHarness(windows = []) {
  const listeners = new Map();
  const calls = { notifications: [], opened: [], focused: [], closed: 0, queried: [], claimed: 0, skipped: 0 };
  const self = {
    location: { origin },
    addEventListener: (type, fn) => listeners.set(type, fn),
    async skipWaiting() { calls.skipped++; },
    clients: {
      async claim() { calls.claimed++; },
      async matchAll() { return windows.map(url => ({ url, async focus() { calls.focused.push(url); } })); },
      async openWindow(url) { calls.opened.push(url); },
    },
    registration: {
      async showNotification(title, settings) { calls.notifications.push({ title, ...settings }); },
      async getNotifications(filter) { calls.queried.push(filter); return [{ close() { calls.closed++; } }]; },
    },
  };
  vm.runInNewContext(workerSource, { self, URL, Date });
  return { calls, listeners, async dispatch(type, event = {}) {
    const promises = [];
    listeners.get(type)({ waitUntil: promise => promises.push(promise), ...event });
    await Promise.all(promises);
  } };
}

await test('loading and connecting never request permission or create a push subscription', async () => {
  for (const permission of ['default', 'granted']) {
    const h = notificationHarness({ permission, existingSubscription: true });
    await flush();
    await h.client.connected();
    assert.equal(h.calls.permission, 0);
    assert.equal(h.calls.subscribe, 0);
    assert.deepEqual(h.calls.sent.map(message => message.type), ['pushStatus']);
    assert.equal(h.get('push-enable').hidden, false);
  }
});

await test('only an explicit enable click requests permission and creates an opted-in subscription', async () => {
  const h = notificationHarness();
  await h.client.connected();
  const action = h.get('push-enable').emit('click');
  assert.equal(h.calls.permission, 1, 'permission starts directly in the click handler');
  await action;
  assert.equal(h.calls.subscribe, 1);
  assert.equal(h.calls.sent.at(-1).type, 'pushSubscribe');
  assert.equal(h.storage.get('privategames.pushWanted'), '1');
  assert.equal(h.get('push-enable').hidden, true);
  assert.equal(h.get('push-test').hidden, false);
});

await test('denied opt-in creates no subscription and remains a playable optional feature', async () => {
  const h = notificationHarness({ permissionResponse: 'denied' });
  await h.client.connected();
  await h.get('push-enable').emit('click');
  assert.equal(h.calls.permission, 1);
  assert.equal(h.calls.subscribe, 0);
  assert.equal(h.calls.sent.some(message => message.type === 'pushSubscribe'), false);
  assert.equal(h.storage.get('privategames.pushWanted'), undefined);
  assert.match(h.get('push-status').textContent, /not granted|blocked/i);
});

await test('an iPhone browser tab shows installation guidance without permission or subscription', async () => {
  const h = notificationHarness({ ios: true });
  await h.client.connected();
  await h.get('push-enable').emit('click');
  assert.equal(h.get('install-help').hidden, false);
  assert.equal(h.get('install-help').open, true);
  assert.equal(h.calls.register, 0);
  assert.equal(h.calls.permission, 0);
  assert.equal(h.calls.subscribe, 0);
});

await test('invalid VAPID encodings and compressed keys are rejected; valid P-256 key decodes', () => {
  const h = notificationHarness();
  assert.deepEqual(Array.from(h.decode(publicKey)), Array.from(keyBytes));
  for (const invalid of [null, '', 'abc', publicKey + '=', 'A'.repeat(87), '+' + publicKey.slice(1), publicKey.slice(0, 86)]) {
    assert.throws(() => h.decode(invalid), /key/i);
  }
  const compressed = createECDH('prime256v1').generateKeys(undefined, 'compressed').toString('base64url');
  assert.throws(() => h.decode(compressed), /key/i);
});

await test('expired private status enables retry and explicit retry creates a fresh endpoint', async () => {
  const h = notificationHarness({ permission: 'granted', existingSubscription: true, serverEnabled: true,
    storage: { 'privategames.pushWanted': '1' } });
  await h.client.connected();
  assert.equal(h.get('push-enable').hidden, true);
  assert.equal(h.client.message({ type: 'push', requestId: null, enabled: false, status: 'expired', publicKey }), true);
  assert.equal(h.get('push-enable').hidden, false);
  assert.equal(h.get('push-enable').disabled, false);
  assert.match(h.get('push-status').textContent, /expired/i);
  assert.equal(h.storage.get('privategames.pushRefreshNeeded'), '1');
  assert.equal(h.calls.subscribe, 0, 'expiry notification cannot silently resubscribe');
  await h.get('push-enable').emit('click');
  assert.deepEqual(h.calls.unsubscribe, [`${origin}/push/stale`]);
  assert.equal(h.calls.subscribe, 1);
  assert.equal(h.calls.sent.at(-1).subscription.endpoint, `${origin}/push/fresh-1`);
  assert.equal(h.storage.get('privategames.pushRefreshNeeded'), '0');
});

await test('persisted expiry prevents stale automatic reattachment after a page reload', async () => {
  const h = notificationHarness({ permission: 'granted', existingSubscription: true,
    storage: { 'privategames.pushWanted': '1', 'privategames.pushRefreshNeeded': '1' } });
  await h.client.connected();
  assert.deepEqual(h.calls.sent.map(message => message.type), ['pushStatus']);
  assert.equal(h.calls.subscribe, 0);
  assert.equal(h.calls.permission, 0);
});

await test('private replies correlate to requests and disconnect settles pending operations', async () => {
  const h = notificationHarness({ autoReply: false });
  let settled = false;
  const connecting = h.client.connected().then(() => { settled = true; });
  const requestId = h.calls.sent[0].requestId;
  assert.equal(h.client.message({ type: 'state' }), false);
  assert.equal(h.client.message({ type: 'push', requestId: 'unrelated', enabled: false }), true);
  await flush();
  assert.equal(settled, false, 'an unrelated response cannot complete the private RPC');
  h.client.message({ type: 'push', requestId, publicKey, enabled: false });
  await connecting;
  assert.equal(h.get('push-enable').disabled, false);
  h.setResponder(message => ({ type: 'push', requestId: message.requestId, publicKey, enabled: true }));
  await h.get('push-enable').emit('click');
  h.setResponder(null);
  const testing = h.get('push-test').emit('click');
  await flush();
  h.client.disconnected();
  await testing;
  assert.equal(h.get('push-test').disabled, true);
  assert.equal(h.timers.timers.size, 0);
  assert.match(h.get('push-status').textContent, /connection changed|rejoin/i);
});

await test('explicit disable revokes server registration and browser subscription', async () => {
  const h = notificationHarness({ permission: 'granted', existingSubscription: true, serverEnabled: true,
    storage: { 'privategames.pushWanted': '1' } });
  await h.client.connected();
  await h.get('push-disable').emit('click');
  assert.equal(h.calls.sent.at(-1).type, 'pushUnsubscribe');
  assert.equal(h.calls.unsubscribe.length, 1);
  assert.equal(h.storage.get('privategames.pushWanted'), '0');
  assert.equal(h.get('push-enable').hidden, false);
});

await test('stale turn pushes still display a generic visible notification without claiming a current turn', async () => {
  const h = workerHarness();
  await h.dispatch('push', { data: { json: () => ({ kind: 'turn', expiresAt: Date.now() - 60000,
    title: 'SECRET CURRENT PLAYER', body: 'GUESS THIS LETTER', url: 'https://evil.example/' }) } });
  assert.equal(h.calls.notifications.length, 1);
  const alert = h.calls.notifications[0];
  assert.equal(alert.title, 'Hangman — game update');
  assert.match(alert.body, /may have moved on/i);
  assert.doesNotMatch(alert.title + alert.body, /SECRET|GUESS THIS/);
  assert.equal(alert.data.url, '/privategames/');
});

await test('ordinary, test and malformed pushes remain visible with bounded display text', async () => {
  const h = workerHarness();
  await h.dispatch('push', { data: { json: () => ({ title: 'T'.repeat(400), body: 'B'.repeat(900), expiresAt: Date.now() + 10000 }) } });
  assert.equal(h.calls.notifications[0].title.length, 90);
  assert.equal(h.calls.notifications[0].body.length, 200);
  assert.equal(h.calls.notifications[0].tag, 'hangman-turn');
  await h.dispatch('push', { data: { json: () => ({ kind: 'test', expiresAt: 1 }) } });
  assert.equal(h.calls.notifications[1].tag, 'hangman-test');
  assert.match(h.calls.notifications[1].title, /test/i);
  await h.dispatch('push', { data: { json() { throw new SyntaxError('bad json'); } } });
  assert.equal(h.calls.notifications.length, 3);
});

await test('notification clicks ignore arbitrary payload URLs and only open or focus the game', async () => {
  const attacks = ['https://evil.example/privategames/', '/admin', 'javascript:alert(1)', '//evil.example/'];
  for (const url of attacks) {
    const h = workerHarness([`${origin}/admin`, 'https://evil.example/privategames/']);
    let closed = false;
    await h.dispatch('notificationclick', { notification: { data: { url }, close() { closed = true; } } });
    assert.equal(closed, true);
    assert.deepEqual(h.calls.opened, ['/privategames/']);
    assert.deepEqual(h.calls.focused, []);
  }
  for (const path of ['/privategames', '/privategames/', '/privategames/?source=homescreen']) {
    const h = workerHarness([`${origin}${path}`]);
    await h.dispatch('notificationclick', { notification: { data: { url: 'https://evil.example/' }, close() {} } });
    assert.deepEqual(h.calls.focused, [`${origin}${path}`]);
    assert.deepEqual(h.calls.opened, []);
  }
});

await test('only game-page messages clear turn alerts; service worker never caches game state', async () => {
  const h = workerHarness();
  assert.equal(h.listeners.has('fetch'), false);
  for (const url of ['https://evil.example/privategames/', `${origin}/admin`, `${origin}/privategames/other`]) {
    await h.dispatch('message', { data: { type: 'clear-turn-alerts' }, source: { url } });
  }
  assert.equal(h.calls.closed, 0);
  await h.dispatch('message', { data: { type: 'clear-turn-alerts' }, source: { url: `${origin}/privategames/` } });
  assert.equal(h.calls.closed, 1);
  assert.equal(h.calls.queried[0].tag, 'hangman-turn');
});

await test('install manifest keeps launch, icon and scope URLs inside the game', () => {
  const manifest = JSON.parse(source('manifest.webmanifest'));
  assert.equal(manifest.id, '/privategames/');
  assert.equal(manifest.scope, '/privategames/');
  assert.equal(new URL(manifest.start_url, origin).pathname, '/privategames/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
  for (const icon of manifest.icons) {
    const url = new URL(icon.src, origin);
    assert.equal(url.origin, origin);
    assert.ok(url.pathname.startsWith('/privategames/'));
  }
});

await test('normal game reads join without moves, ignore older snapshots, and enforce client turn controls', async () => {
  const { document, get } = dom();
  const timers = clock();
  get('vocabulary').value = 'middle'; get('turn-rule').value = 'vote';
  get('player-name').tagName = 'INPUT';
  const id = '11111111-1111-4111-8111-111111111111';
  const other = '22222222-2222-4222-8222-222222222222';
  const storage = new Map([['privategames.clientId', id], ['privategames.name', 'Player One']]);
  const clients = [];
  class Socket extends Node {
    static OPEN = 1; static CONNECTING = 0;
    constructor(url) { super(); this.url = String(url); this.readyState = 0; this.sent = []; clients.push(this); }
    send(value) { this.sent.push(value === 'ping' ? value : JSON.parse(value)); }
    close() { this.readyState = 3; }
  }
  const window = new Node();
  const players = [{ id, name: 'Player One', connected: true }, { id: other, name: 'Player Two', connected: true }];
  const game = (revision = 1, activePlayerId = id) => ({
    roundId: 'round-1', revision, roundNumber: 1, length: 3, mask: [null, null, null], answer: null,
    strikes: 0, guesses: [], wins: 0, losses: 0, clueShown: false, clue: null, status: 'playing',
    settings: { vocabulary: 'middle', minLength: 3, maxLength: 15, turnMode: 'vote', turnSeconds: 90 },
    turn: { activePlayerId, activePlayerName: activePlayerId === id ? 'Player One' : 'Player Two',
      order: players, waiting: [], cycle: 1, token: `turn-${revision}`, deadlineAt: Date.now() + 90000,
      vote: { voterIds: [], eligibleIds: [other], required: 2 } },
  });
  const envelope = state => ({ type: 'state', state, players, serverTime: Date.now(), catalog: {
    total: 60000, levels: [{ id: 'middle', countsByLength: { 3: 200 } }],
  } });
  const context = vm.createContext({
    document, window, Element: Node, navigator: { onLine: true },
    location: { href: `${origin}/privategames`, protocol: 'https:' }, URL,
    WebSocket: Socket, crypto: webcrypto, Uint8Array, ...timers,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    btoa: value => Buffer.from(value, 'binary').toString('base64'),
    confirm: () => true,
    fetch: async () => ({ ok: true, async json() { return envelope(game()); } }),
    createTurnNotifications: () => ({ message: () => false, connected() {}, disconnected() {}, setTurn() {} }),
  });
  vm.runInContext(source('game.js').replace(/^import[^\n]+\n/, ''), context);
  await flush();
  assert.equal(clients.length, 1);
  const socket = clients[0];
  assert.equal(socket.url, 'wss://hangman.example/privategames/api/socket');
  assert.equal(socket.sent.length, 0, 'read-only snapshot load must not make game moves');
  socket.readyState = Socket.OPEN;
  await socket.emit('open');
  assert.equal(socket.sent[0].type, 'join');
  assert.equal(socket.sent[0].protocol, 3);
  assert.match(socket.sent[0].ownerSecret, /^[A-Za-z0-9_-]{43}$/);
  await socket.emit('message', { data: JSON.stringify(envelope(game(2))) });
  const keyboard = get('keyboard').children;
  assert.equal(keyboard.length, 26);
  assert.equal(keyboard[0].disabled, false);
  await keyboard[0].emit('click');
  assert.deepEqual(JSON.parse(JSON.stringify(socket.sent.at(-1))), { type: 'guess', roundId: 'round-1', turnToken: 'turn-2', letter: 'A' });
  const accepted = game(3, other);
  accepted.guesses = [{ letter: 'A', correct: true, player: 'Player One' }];
  accepted.mask = [null, 'A', null];
  await socket.emit('message', { data: JSON.stringify(envelope(accepted)) });
  assert.ok(keyboard.every(key => key.disabled));
  const actions = socket.sent.length;
  await document.emit('keydown', { key: 'B', target: get('keyboard') });
  assert.equal(socket.sent.length, actions, 'off-turn keyboard input must not send a move');
  await socket.emit('message', { data: JSON.stringify(envelope(game(1))) });
  assert.equal(get('turn-player').textContent, 'Player Two', 'a stale snapshot cannot revert the active player');
  assert.equal(get('word').children[1].textContent, 'A');
});

console.log(`${passed} privategames client tests passed.`);
