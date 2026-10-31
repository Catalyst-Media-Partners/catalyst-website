import test from 'node:test';
import assert from 'node:assert/strict';
import { createECDH, createDecipheriv, createPublicKey, hkdfSync, randomBytes, verify } from 'node:crypto';
import {
  ensurePushKeys, ensurePushAuthorization, createVapidAuthorization,
  encryptPushPayload, validatePushEndpoint, validatePushSubscription,
  sendWebPush, VAPID_KEY_STORAGE_KEY, VAPID_SUBJECT,
} from '../src/privategames/push.mjs';
import {
  createPushStore, loadPushStore, savePushStore, claimDevice, pushStatus,
  subscribe, unsubscribe, queueTurn, queueTest, pruneTurnJobs,
  dueTasks, claimDueTasks, nextRetryAt, completeTask, PUSH_STORE_KEY,
} from '../src/privategames/push-store.mjs';

// No real push endpoints are contacted. Every transport test injects a fake fetch.
const NOW = 1_900_000_000_000;
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const secret = () => randomBytes(32).toString('base64url');
const payload = { title: 'Your turn', body: 'Choose a letter.', kind: 'turn', url: '/privategames/' };

class MemoryStorage {
  values = new Map();
  tail = Promise.resolve();
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  transaction(operation) {
    const run = this.tail.then(async () => {
      const before = structuredClone(this.values);
      try { return await operation(this); }
      catch (error) { this.values = before; throw error; }
    });
    this.tail = run.catch(() => {});
    return run;
  }
}

function recipient(endpoint = 'https://fcm.googleapis.com/fcm/send/test-only-token') {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return {
    ecdh, auth,
    subscription: { endpoint, expirationTime: null, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } },
  };
}

// Independent OpenSSL-backed Node crypto decryptor. It imports none of the
// production derivation/base64 helpers and is anchored to the published RFC vector.
function decrypt(bodyValue, ecdh, auth) {
  const body = Buffer.from(bodyValue);
  assert.equal(body.readUInt32BE(16), 4096);
  assert.equal(body[20], 65);
  const salt = body.subarray(0, 16);
  const sender = body.subarray(21, 86);
  const shared = ecdh.computeSecret(sender);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), sender]);
  const ikm = hkdfSync('sha256', shared, auth, info, 32);
  const cek = hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
  decipher.setAuthTag(body.subarray(body.length - 16));
  const clear = Buffer.concat([decipher.update(body.subarray(86, body.length - 16)), decipher.final()]);
  assert.equal(clear.at(-1), 2, 'final record delimiter');
  return clear.subarray(0, clear.length - 1);
}

async function subscribed(id = A, subscription = recipient().subscription) {
  const ownerSecret = secret();
  let store = await claimDevice(createPushStore(), id, ownerSecret, NOW);
  store = await subscribe(store, id, subscription, NOW);
  return { store, ownerSecret, subscription };
}

function enqueue(store, token = 'turn-one', now = NOW) {
  return queueTurn(store, { turnToken: token, playerId: A, payload, expiresAt: now + 120_000 }, now);
}

test('independent decryptor matches RFC 8291 Appendix A known vector', () => {
  const ua = createECDH('prime256v1');
  ua.setPrivateKey(Buffer.from('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94', 'base64url'));
  const header = Buffer.alloc(86);
  Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url').copy(header);
  header.writeUInt32BE(4096, 16);
  header[20] = 65;
  Buffer.from('BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8', 'base64url').copy(header, 21);
  const ciphertext = Buffer.from('8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ', 'base64url');
  assert.equal(decrypt(Buffer.concat([header, ciphertext]), ua, Buffer.from('BTBZMqHH6r4Tts7J_aSIgg', 'base64url')).toString(), 'When I grow up, I want to be a watermelon');
});

test('Worker WebCrypto payload independently decrypts with Node crypto', async () => {
  const client = recipient();
  const original = { ...payload, body: 'It’s your turn, Zoë! 🎯', turnToken: 't1' };
  const body = await encryptPushPayload(client.subscription, original);
  assert.deepEqual(JSON.parse(decrypt(body, client.ecdh, client.auth).toString()), original);
  const another = await encryptPushPayload(client.subscription, original);
  assert.notEqual(Buffer.from(body).subarray(0, 16).toString('hex'), Buffer.from(another).subarray(0, 16).toString('hex'));
  assert.notEqual(Buffer.from(body).subarray(21, 86).toString('hex'), Buffer.from(another).subarray(21, 86).toString('hex'));
});

test('single record honors the RFC 4096-byte total delivery minimum', async () => {
  const client = recipient();
  const body = await encryptPushPayload(client.subscription, 'a'.repeat(3993));
  assert.equal(body.length, 4096);
  assert.equal(decrypt(body, client.ecdh, client.auth).length, 3993);
  await assert.rejects(encryptPushPayload(client.subscription, 'a'.repeat(3994)), { code: 'payload-too-large' });
  await assert.rejects(encryptPushPayload(client.subscription, '🎯'.repeat(1000)), { code: 'payload-too-large' });
});

test('VAPID key persists once, including concurrent first use and reload', async () => {
  const storage = new MemoryStorage();
  const keys = await Promise.all(Array.from({ length: 4 }, () => ensurePushKeys(storage, NOW)));
  assert.equal(new Set(keys.map(key => key.publicKey)).size, 1);
  const loaded = await ensurePushKeys(storage, NOW + 10_000);
  assert.equal(loaded.publicKey, keys[0].publicKey);
  assert.ok(storage.values.has(VAPID_KEY_STORAGE_KEY));
  assert.equal(loaded.subject, VAPID_SUBJECT);
  assert.equal(Buffer.from(loaded.publicKey, 'base64url').length, 65);
});

test('VAPID ES256 signature independently verifies and claims obey RFC 8292', async () => {
  const keys = await ensurePushKeys(new MemoryStorage(), NOW);
  const { authorization, expiresAt } = await createVapidAuthorization(keys, 'https://web.push.apple.com/opaque-token', NOW);
  const match = /^vapid t=([^, ]+), k=([A-Za-z0-9_-]+)$/.exec(authorization);
  assert.ok(match);
  const [head, body, signature] = match[1].split('.');
  assert.deepEqual(JSON.parse(Buffer.from(head, 'base64url').toString()), { typ: 'JWT', alg: 'ES256' });
  const claims = JSON.parse(Buffer.from(body, 'base64url').toString());
  assert.deepEqual(claims, { aud: 'https://web.push.apple.com', exp: Math.floor(NOW / 1000) + 43_200, sub: VAPID_SUBJECT });
  assert.equal(expiresAt, claims.exp * 1000);
  const point = Buffer.from(match[2], 'base64url');
  const key = createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: point.subarray(1, 33).toString('base64url'), y: point.subarray(33).toString('base64url') } });
  assert.ok(verify('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')));
  assert.equal(verify('sha256', Buffer.from(`${head}.${body}x`), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(signature, 'base64url')), false);
});

test('VAPID authorization cache survives reload and avoids frequent Apple token refresh', async () => {
  const storage = new MemoryStorage();
  const keys = await ensurePushKeys(storage, NOW);
  const first = await ensurePushAuthorization(storage, keys, 'https://web.push.apple.com/token-one', NOW);
  const second = await ensurePushAuthorization(storage, await ensurePushKeys(storage, NOW + 10_000), 'https://web.push.apple.com/token-two', NOW + 10_000);
  assert.equal(first, second);
  const renewed = await ensurePushAuthorization(storage, keys, 'https://web.push.apple.com/token-one', NOW + 11 * 60 * 60_000);
  assert.notEqual(first, renewed);
});

test('only supported production HTTPS push hosts are accepted', async () => {
  const valid = [
    'https://web.push.apple.com/opaque',
    'https://eu.web.push.apple.com/opaque',
    'https://fcm.googleapis.com/fcm/send/opaque',
    'https://updates.push.services.mozilla.com/wpush/v2/opaque',
  ];
  for (const endpoint of valid) {
    assert.equal(validatePushEndpoint(endpoint), endpoint);
    assert.equal((await validatePushSubscription(recipient(endpoint).subscription, NOW)).endpoint, endpoint);
  }
  const invalid = [
    'http://fcm.googleapis.com/fcm/send/x', 'https://127.0.0.1/x', 'https://[::1]/x',
    'https://169.254.169.254/x', 'https://example.com/x',
    'https://fcm.googleapis.com.evil.test/x', 'https://push.apple.com.evil.test/x',
    'https://evilpush.apple.com/x', 'https://push.apple.com/x',
    'https://evil@fcm.googleapis.com/x', 'https://fcm.googleapis.com:443/x',
    'https://fcm.googleapis.com:8443/x', 'https://fcm.googleapis.com/x#fragment',
    'https://fcm.googleapis.com/x#', 'https://%66cm.googleapis.com/x',
    'https://fcm.googleapis.com./x', 'https://fcm.googleapis.com\\@evil.test/x',
    ' https://fcm.googleapis.com/x', 'https://fcm.googleapis.com/x\n',
    'https://fcm.googleapis.com/', 'https://fcm.googleapis.com/' + 'x'.repeat(2048),
  ];
  for (const endpoint of invalid) assert.throws(() => validatePushEndpoint(endpoint), undefined, endpoint);
});

test('subscription encryption keys require canonical base64url, exact lengths and valid P-256 point', async () => {
  const input = recipient().subscription;
  for (const p256dh of [input.keys.p256dh + '=', 'A'.repeat(87), Buffer.alloc(65, 4).toString('base64url'), Buffer.alloc(64).toString('base64url')]) {
    await assert.rejects(validatePushSubscription({ ...input, keys: { ...input.keys, p256dh } }, NOW));
  }
  for (const auth of [input.keys.auth + '=', 'A'.repeat(21), 'A'.repeat(23), 'A'.repeat(21) + 'B']) {
    await assert.rejects(validatePushSubscription({ ...input, keys: { ...input.keys, auth } }, NOW));
  }
  await assert.rejects(validatePushSubscription({ ...input, expirationTime: NOW - 1 }, NOW), { code: 'expired-subscription' });
  await assert.rejects(validatePushSubscription({ ...input, extra: 'x'.repeat(4096) }, NOW));
});

test('transport uses encrypted POST, correct headers, redirect rejection and bounded TTL', async () => {
  const client = recipient();
  const keys = await ensurePushKeys(new MemoryStorage(), NOW);
  let calls = 0;
  const result = await sendWebPush(client.subscription, payload, keys, {
    now: NOW, ttl: 999, topic: 'hangman-turn',
    fetchImpl: async (endpoint, request) => {
      calls += 1;
      assert.equal(endpoint, client.subscription.endpoint);
      assert.equal(request.method, 'POST');
      assert.equal(request.redirect, 'error');
      assert.equal(request.credentials, 'omit');
      assert.equal(request.headers['Content-Encoding'], 'aes128gcm');
      assert.equal(request.headers.TTL, '300');
      assert.equal(request.headers.Topic, 'hangman-turn');
      assert.match(request.headers.Authorization, /^vapid t=/);
      assert.deepEqual(JSON.parse(decrypt(request.body, client.ecdh, client.auth).toString()), payload);
      return new Response(null, { status: 201 });
    },
  });
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: true, expired: false, retryable: false, status: 201, code: 'accepted', retryAfterMs: 0 });
});

test('transport distinguishes expiration, permanent rejection and limited retry eligibility', async () => {
  const client = recipient();
  const keys = await ensurePushKeys(new MemoryStorage(), NOW);
  for (const status of [404, 410, 400, 401, 403, 413, 429, 500, 503]) {
    const result = await sendWebPush(client.subscription, payload, keys, { now: NOW, fetchImpl: async () => new Response('private provider details', { status, headers: { 'Retry-After': '9999' } }) });
    assert.equal(result.expired, status === 404 || status === 410);
    assert.equal(result.retryable, status === 429 || status >= 500);
    assert.equal(result.retryAfterMs, result.retryable ? 9_999_000 : 0);
    assert.equal(JSON.stringify(result).includes(client.subscription.endpoint), false);
    assert.equal(JSON.stringify(result).includes('private provider details'), false);
  }
  const result = await sendWebPush(client.subscription, payload, keys, { now: NOW, fetchImpl: async () => { throw new Error('network failure with private endpoint'); } });
  assert.equal(result.code, 'network-failure');
  assert.equal(result.retryable, true);
});

test('transport timeout aborts and invalid subscription never calls fetch', async () => {
  const client = recipient();
  const keys = await ensurePushKeys(new MemoryStorage(), NOW);
  let aborted = false;
  const result = await sendWebPush(client.subscription, payload, keys, {
    now: NOW, timeoutMs: 1,
    fetchImpl: async (_endpoint, request) => new Promise((_resolve, reject) => request.signal.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); })),
  });
  assert.equal(aborted, true);
  assert.equal(result.retryable, true);
  let calls = 0;
  const invalid = await sendWebPush({ ...client.subscription, endpoint: 'https://localhost/private' }, payload, keys, { fetchImpl: async () => { calls += 1; } });
  assert.equal(calls, 0);
  assert.equal(invalid.retryable, false);
});

test('ownership uses a separate secret, resumes securely and never leaks in public status', async () => {
  const ownerSecret = secret();
  const initial = createPushStore();
  let store = await claimDevice(initial, A, ownerSecret, NOW);
  assert.equal(Object.keys(initial.owners).length, 0, 'transformation is pure');
  assert.equal(JSON.stringify(store).includes(ownerSecret), false, 'only hash persisted');
  store = await claimDevice(store, A, ownerSecret, NOW + 1);
  await assert.rejects(claimDevice(store, A, secret(), NOW), { code: 'owner-mismatch' });
  await assert.rejects(claimDevice(store, A, undefined, NOW), { code: 'invalid-owner' });
  await assert.rejects(claimDevice(store, '__proto__', ownerSecret, NOW), { code: 'invalid-player' });
  assert.deepEqual(pushStatus(store, A), { enabled: false, status: 'disabled' });
  const storage = new MemoryStorage();
  await storage.transaction(() => savePushStore(storage, store));
  const loaded = await loadPushStore(storage);
  assert.equal(loaded.owners[A].secretHash, store.owners[A].secretHash);
  assert.ok(storage.values.has(PUSH_STORE_KEY));
});

test('private subscriptions are normalized, cannot be claimed by another player, and can be removed', async () => {
  const state = await subscribed();
  let store = await claimDevice(state.store, B, secret(), NOW);
  await assert.rejects(subscribe(store, B, state.subscription, NOW), { code: 'subscription-owned' });
  assert.deepEqual(pushStatus(store, A), { enabled: true, status: 'enabled' });
  assert.equal(Object.keys(pushStatus(store, A)).join(','), 'enabled,status');
  store = enqueue(store);
  store = unsubscribe(store, A);
  assert.equal(store.outbox.length, 0);
  assert.equal(store.subscriptions[A], undefined);
  assert.equal(pushStatus(store, A).enabled, false);
});

test('outbox deduplicates accepted turns before and after send, including persistence reload', async () => {
  let { store } = await subscribed();
  store = enqueue(store);
  store = enqueue(store);
  assert.equal(store.outbox.length, 1);
  const claimed = claimDueTasks(store, NOW);
  assert.equal(claimed.tasks.length, 1);
  assert.equal(claimed.tasks[0].attempts, 1);
  assert.equal(dueTasks(claimed.store, NOW).length, 0);
  const task = claimed.tasks[0];
  store = completeTask(claimed.store, task.id, { ok: true }, NOW + 1, task.attempts);
  assert.equal(store.outbox.length, 0);
  const storage = new MemoryStorage();
  await savePushStore(storage, store);
  store = enqueue(await loadPushStore(storage));
  assert.equal(store.outbox.length, 0);
  assert.equal(nextRetryAt(store), null);
  store = enqueue(store, 'turn-two');
  assert.equal(store.outbox.length, 1);
});

test('turn queue without an opt-in does nothing and contains no secret word fields', async () => {
  let store = await claimDevice(createPushStore(), A, secret(), NOW);
  store = enqueue(store);
  assert.equal(store.outbox.length, 0);
  assert.equal(nextRetryAt(store), null);
  store = await subscribe(store, A, recipient().subscription, NOW);
  assert.equal(enqueue(store).outbox.length, 0, 'enabling does not replay an already-seen turn');
  store = enqueue(store, 'next-turn');
  const [task] = dueTasks(store, NOW);
  assert.deepEqual(Object.keys(task.payload).sort(), ['body', 'expiresAt', 'kind', 'title', 'turnToken', 'url']);
});

test('failed transport retries at most three claimed attempts then stops', async () => {
  let { store } = await subscribed();
  store = enqueue(store);
  let now = NOW;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const claim = claimDueTasks(store, now);
    assert.equal(claim.tasks.length, 1);
    const task = claim.tasks[0];
    assert.equal(task.attempts, attempt);
    store = completeTask(claim.store, task.id, { ok: false, retryable: true, retryAfterMs: 1000 }, now, attempt);
    if (attempt < 3) {
      assert.ok(nextRetryAt(store) > now);
      now = nextRetryAt(store);
    }
  }
  assert.equal(store.outbox.length, 0);
  assert.equal(nextRetryAt(store), null);
  assert.deepEqual(pushStatus(store, A), { enabled: true, status: 'failed' });
});

test('claims survive process loss and stale attempt completions cannot override newer attempts', async () => {
  let { store } = await subscribed();
  let claim = claimDueTasks(enqueue(store), NOW);
  store = claim.store;
  const original = claim.tasks[0];
  claim = claimDueTasks(structuredClone(store), NOW + 30_000);
  assert.equal(claim.tasks[0].attempts, 2);
  store = completeTask(claim.store, original.id, { expired: true }, NOW + 30_001, original.attempts);
  assert.ok(store.subscriptions[A], 'late first attempt cannot delete subscription');
  claim = claimDueTasks(store, NOW + 60_000);
  assert.equal(claim.tasks[0].attempts, 3);
  claim = claimDueTasks(claim.store, NOW + 90_000);
  assert.equal(claim.tasks.length, 0);
  assert.equal(claim.store.outbox.length, 0);
  assert.equal(nextRetryAt(claim.store), null);
  assert.equal(pushStatus(claim.store, A).status, 'failed');
});

test('provider Retry-After beyond turn expiry stops the job instead of retrying early', async () => {
  const { store } = await subscribed();
  const claim = claimDueTasks(enqueue(store), NOW);
  const task = claim.tasks[0];
  const completed = completeTask(claim.store, task.id, { ok: false, retryable: true, retryAfterMs: 9_999_000 }, NOW, task.attempts);
  assert.equal(completed.outbox.length, 0);
  assert.equal(nextRetryAt(completed), null);
});

test('expired providers remove only matching subscription; replacement is protected from stale response', async () => {
  let { store } = await subscribed();
  const claim = claimDueTasks(enqueue(store), NOW);
  const task = claim.tasks[0];
  const expired = completeTask(claim.store, task.id, { expired: true }, NOW + 1, 1);
  assert.equal(expired.subscriptions[A], undefined);
  assert.deepEqual(pushStatus(expired, A), { enabled: false, status: 'expired' });
  store = await subscribe(claim.store, A, recipient('https://web.push.apple.com/replacement').subscription, NOW + 1);
  store = completeTask(store, task.id, { expired: true }, NOW + 2, 1);
  assert.equal(store.subscriptions[A].subscription.endpoint, 'https://web.push.apple.com/replacement');
});

test('obsolete or paused turn jobs are pruned while explicit tests remain, with test rate limit', async () => {
  let { store } = await subscribed();
  store = enqueue(store);
  store = queueTest(store, { playerId: A, payload: { ...payload, kind: 'test' } }, NOW);
  assert.equal(store.outbox.length, 2);
  assert.throws(() => queueTest(store, { playerId: A, payload }, NOW + 1000), { code: 'test-rate-limit' });
  store = pruneTurnJobs(store, { turnToken: 'turn-one', activePlayerId: A, paused: true }, NOW);
  assert.equal(store.outbox.length, 1);
  assert.equal(store.outbox[0].kind, 'test');
  store = pruneTurnJobs(store, { turnToken: 'turn-one', activePlayerId: A, paused: false }, NOW + 60_001);
  assert.equal(store.outbox.length, 0);
  assert.equal(nextRetryAt(store), null);
});
