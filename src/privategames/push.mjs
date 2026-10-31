/**
 * Standards Web Push using only Web Crypto and fetch (Cloudflare Workers).
 * RFC 8291 sections 3–4 / RFC 8188: one aes128gcm record, with a fresh ECDH key.
 * RFC 8292: a separate, stable P-256 VAPID signing key. Private records below
 * must never be included in a game snapshot or a WebSocket response.
 * Sources: https://www.rfc-editor.org/rfc/rfc8291
 * https://www.rfc-editor.org/rfc/rfc8292
 * https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
 */

export const VAPID_KEY_STORAGE_KEY = 'hangman-vapid-private-v1';
export const VAPID_SUBJECT = 'https://catalystmediapartners.com/privategames';
export const MAX_PUSH_PAYLOAD_BYTES = 3993;
const VAPID_AUTH_STORAGE_KEY = 'hangman-vapid-auth-private-v1';
const encoder = new TextEncoder();
const P256 = { name: 'ECDH', namedCurve: 'P-256' };
const ECDSA = { name: 'ECDSA', namedCurve: 'P-256' };
const importedVapidKeys = new WeakMap();

export class PushError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = 'PushError';
    this.code = code;
  }
}

export function toBase64Url(value) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function fromBase64Url(value, length) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value) || value.length > 4096) {
    throw new PushError('invalid-key', 'Invalid push encryption key.');
  }
  let bytes;
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4));
    bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  } catch {
    throw new PushError('invalid-key', 'Invalid push encryption key.');
  }
  if ((length !== undefined && bytes.length !== length) || toBase64Url(bytes) !== value) {
    throw new PushError('invalid-key', 'Invalid push encryption key.');
  }
  return bytes;
}

function concat(...arrays) {
  const result = new Uint8Array(arrays.reduce((length, bytes) => length + bytes.length, 0));
  let offset = 0;
  for (const bytes of arrays) { result.set(bytes, offset); offset += bytes.length; }
  return result;
}

/** Browser-owned production services only. Endpoints are opaque capability URLs.
 * Apple: developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers
 * Google: web.dev/articles/push-notifications-subscribing-a-user
 * Mozilla: mozilla-services.github.io/autopush-rs/ (production endpoint).
 * No arbitrary HTTPS target, redirect, credential, explicit port or fragment.
 */
export function validatePushEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || /[\s\\#]/.test(endpoint)) {
    throw new PushError('invalid-endpoint', 'Invalid push service address.');
  }
  let url;
  try { url = new URL(endpoint); } catch { throw new PushError('invalid-endpoint', 'Invalid push service address.'); }
  const authority = /^https:\/\/([^/?#]+)/i.exec(endpoint)?.[1];
  if (url.protocol !== 'https:' || !authority || authority.includes(':') || authority.includes('@') ||
      authority.toLowerCase() !== url.hostname || url.username || url.password || url.port || url.hash || url.pathname === '/') {
    throw new PushError('invalid-endpoint', 'Invalid push service address.');
  }
  const host = url.hostname;
  const apple = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+push\.apple\.com$/.test(host);
  if (!apple && host !== 'fcm.googleapis.com' && host !== 'updates.push.services.mozilla.com') {
    throw new PushError('unsupported-service', 'This browser uses an unsupported push service.');
  }
  return url.href;
}

export async function validatePushSubscription(input, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || !input.keys || typeof input.keys !== 'object') {
    throw new PushError('invalid-subscription', 'Invalid push subscription.');
  }
  let size;
  try { size = encoder.encode(JSON.stringify(input)).length; } catch { size = Infinity; }
  if (size > 4096) throw new PushError('invalid-subscription', 'Push subscription is too large.');
  const endpoint = validatePushEndpoint(input.endpoint);
  const publicKey = fromBase64Url(input.keys.p256dh, 65);
  const auth = fromBase64Url(input.keys.auth, 16);
  if (publicKey[0] !== 4) throw new PushError('invalid-key', 'Invalid push encryption key.');
  try { await crypto.subtle.importKey('raw', publicKey, P256, false, []); }
  catch { throw new PushError('invalid-key', 'Invalid push encryption key.'); }
  const expirationTime = input.expirationTime ?? null;
  if (expirationTime !== null && (!Number.isSafeInteger(expirationTime) || expirationTime <= now)) {
    throw new PushError('expired-subscription', 'This notification subscription has expired.');
  }
  return { endpoint, expirationTime, keys: { p256dh: toBase64Url(publicKey), auth: toBase64Url(auth) } };
}

function payloadBytes(payload) {
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
  if (typeof text !== 'string') throw new PushError('invalid-payload');
  const bytes = encoder.encode(text);
  if (bytes.length > MAX_PUSH_PAYLOAD_BYTES) throw new PushError('payload-too-large');
  return bytes;
}

async function hkdf(ikm, salt, info, length) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, length * 8));
}

/** A complete RFC 8188 body: 86-byte header followed by a single encrypted record. */
export async function encryptPushPayload(subscription, payload) {
  const receiver = fromBase64Url(subscription.keys.p256dh, 65);
  const auth = fromBase64Url(subscription.keys.auth, 16);
  const peer = await crypto.subtle.importKey('raw', receiver, P256, false, []);
  const ephemeral = await crypto.subtle.generateKey(P256, true, ['deriveBits']);
  const sender = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeral.publicKey));
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, ephemeral.privateKey, 256));
  const ikm = await hkdf(shared, auth, concat(encoder.encode('WebPush: info\0'), receiver, sender), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const [cek, nonce] = await Promise.all([
    hkdf(ikm, salt, encoder.encode('Content-Encoding: aes128gcm\0'), 16),
    hkdf(ikm, salt, encoder.encode('Content-Encoding: nonce\0'), 12),
  ]);
  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const plaintext = concat(payloadBytes(payload), new Uint8Array([2]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, key, plaintext));
  const header = new Uint8Array(86);
  header.set(salt);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = sender.length;
  header.set(sender, 21);
  return concat(header, ciphertext);
}

async function importVapidKey(keys) {
  if (importedVapidKeys.has(keys)) return importedVapidKeys.get(keys);
  const jwk = keys?.privateJwk;
  const publicKey = fromBase64Url(keys?.publicKey, 65);
  if (keys?.version !== 1 || keys.subject !== VAPID_SUBJECT || jwk?.kty !== 'EC' || jwk.crv !== 'P-256' ||
      publicKey[0] !== 4 || jwk.x !== toBase64Url(publicKey.slice(1, 33)) || jwk.y !== toBase64Url(publicKey.slice(33))) {
    throw new PushError('invalid-server-key');
  }
  fromBase64Url(jwk.d, 32);
  const key = await crypto.subtle.importKey('jwk', jwk, ECDSA, false, ['sign']);
  importedVapidKeys.set(keys, key);
  return key;
}

/** Do not rotate automatically: existing subscriptions are restricted to this key. */
export async function ensurePushKeys(storage, now = Date.now()) {
  const stored = await storage.get(VAPID_KEY_STORAGE_KEY);
  if (stored !== undefined && stored !== null) { await importVapidKey(stored); return stored; }
  const pair = await crypto.subtle.generateKey(ECDSA, true, ['sign', 'verify']);
  const record = {
    version: 1,
    publicKey: toBase64Url(await crypto.subtle.exportKey('raw', pair.publicKey)),
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    subject: VAPID_SUBJECT,
    createdAt: now,
  };
  // A transaction recheck protects first use by concurrent events. On SQLite DOs,
  // storage operations on the parent object participate in this transaction.
  let chosen;
  await storage.transaction(async () => {
    chosen = await storage.get(VAPID_KEY_STORAGE_KEY);
    if (chosen === undefined || chosen === null) { chosen = record; await storage.put(VAPID_KEY_STORAGE_KEY, chosen); }
  });
  await importVapidKey(chosen);
  return chosen;
}

export async function createVapidAuthorization(keys, endpoint, now = Date.now()) {
  const aud = new URL(validatePushEndpoint(endpoint)).origin;
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const expiresAt = Math.floor(now / 1000) + 12 * 60 * 60;
  const claims = toBase64Url(encoder.encode(JSON.stringify({ aud, exp: expiresAt, sub: VAPID_SUBJECT })));
  const signingInput = `${header}.${claims}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await importVapidKey(keys), encoder.encode(signingInput)));
  if (signature.length !== 64) throw new PushError('invalid-signature');
  return { authorization: `vapid t=${signingInput}.${toBase64Url(signature)}, k=${keys.publicKey}`, expiresAt: expiresAt * 1000 };
}

/** Persist per-origin VAPID authorization across DO hibernation. Apple requires
 * avoiding refresh more than once per hour; these tokens are reused for 11h.
 * This key has no game data and makes no network request or alarm change.
 */
export async function ensurePushAuthorization(storage, keys, endpoint, now = Date.now()) {
  const origin = new URL(validatePushEndpoint(endpoint)).origin;
  const cache = (await storage.get(VAPID_AUTH_STORAGE_KEY)) ?? {};
  const cached = cache[origin];
  if (cached?.publicKey === keys.publicKey && cached.expiresAt > now + 60 * 60 * 1000 && typeof cached.authorization === 'string') {
    return cached.authorization;
  }
  const created = { ...await createVapidAuthorization(keys, endpoint, now), publicKey: keys.publicKey };
  let chosen;
  await storage.transaction(async () => {
    const current = (await storage.get(VAPID_AUTH_STORAGE_KEY)) ?? {};
    chosen = current[origin];
    if (chosen?.publicKey !== keys.publicKey || !(chosen.expiresAt > now + 60 * 60 * 1000)) {
      chosen = created;
      current[origin] = chosen;
      // Bound provider-origin history even if a caller submits many distinct
      // (allowlisted) Apple hosts. Production browsers use very few origins.
      const entries = Object.entries(current).sort((a, b) => b[1].expiresAt - a[1].expiresAt);
      await storage.put(VAPID_AUTH_STORAGE_KEY, Object.fromEntries(entries.slice(0, 64)));
    }
  });
  return chosen.authorization;
}

function retryDelay(value, now) {
  let milliseconds = /^\d+$/.test(value ?? '') ? Number(value) * 1000 : Date.parse(value ?? '') - now;
  if (Number.isNaN(milliseconds)) milliseconds = 5000;
  // A provider's longer Retry-After should expire a short-lived turn job, not
  // cause us to retry earlier than requested. The outbox compares this to expiry.
  return Math.max(1000, Math.min(milliseconds, 24 * 60 * 60 * 1000));
}

/** Exactly one attempt. The durable outbox owns bounded retries and deduplication.
 * Never return provider bodies, endpoints or key material in the outcome.
 */
export async function sendWebPush(subscription, payload, keys, options = {}) {
  const now = options.now ?? Date.now();
  let normalized;
  let body;
  let authorization;
  try {
    normalized = await validatePushSubscription(subscription, now);
    body = await encryptPushPayload(normalized, payload);
    authorization = options.authorization ?? (await createVapidAuthorization(keys, normalized.endpoint, now)).authorization;
  } catch (error) {
    return { ok: false, expired: error?.code === 'expired-subscription', retryable: false, status: 0, code: error?.code ?? 'invalid-push', retryAfterMs: 0 };
  }
  const headers = {
    Authorization: authorization,
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(Math.max(0, Math.min(300, Math.floor(options.ttl ?? 60)))),
    Urgency: 'high',
  };
  if (options.topic && /^[A-Za-z0-9_-]{1,32}$/.test(options.topic)) headers.Topic = options.topic;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1, Math.min(options.timeoutMs ?? 8000, 8000)));
  try {
    const response = await (options.fetchImpl ?? fetch)(normalized.endpoint, {
      method: 'POST', headers, body, redirect: 'error', credentials: 'omit', signal: controller.signal,
    });
    // Bodies can contain private routing details. Do not read, persist or log them.
    if (response.body) await response.body.cancel().catch(() => {});
    const ok = response.status >= 200 && response.status < 300;
    const expired = response.status === 404 || response.status === 410;
    const retryable = response.status === 429 || response.status >= 500;
    return { ok, expired, retryable, status: response.status, code: ok ? 'accepted' : expired ? 'expired' : retryable ? 'temporary-failure' : 'rejected', retryAfterMs: retryable ? retryDelay(response.headers.get('Retry-After'), now) : 0 };
  } catch {
    return { ok: false, expired: false, retryable: true, status: 0, code: 'network-failure', retryAfterMs: 5000 };
  } finally { clearTimeout(timeout); }
}
