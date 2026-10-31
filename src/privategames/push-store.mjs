/** Private Durable Object push data. No helper here changes an alarm or fetches.
 * Room callers persist returned states in the SAME transaction as the turn.
 * Never spread this store, owners, tasks, subscriptions or hashes into public state.
 */
import { PushError, fromBase64Url, toBase64Url, validatePushSubscription } from './push.mjs';

export const PUSH_STORE_KEY = 'hangman-push-private-v1';
export const MAX_PUSH_ATTEMPTS = 3;
const MAX_SUBSCRIPTIONS = 64;
const MAX_OWNERS = 256;
const MAX_OUTBOX = 128;
const LEASE_MS = 30_000;
const TEST_INTERVAL_MS = 60_000;
const MAX_JOB_LIFETIME_MS = 5 * 60_000;
const encoder = new TextEncoder();

export function createPushStore() {
  return { version: 1, owners: {}, subscriptions: {}, outbox: [] };
}

export async function loadPushStore(storage) {
  const stored = await storage.get(PUSH_STORE_KEY);
  if (stored === undefined || stored === null) return createPushStore();
  if (stored.version !== 1 || !stored.owners || !stored.subscriptions || !Array.isArray(stored.outbox) ||
      Object.keys(stored.owners).length > MAX_OWNERS || Object.keys(stored.subscriptions).length > MAX_SUBSCRIPTIONS || stored.outbox.length > MAX_OUTBOX) {
    // Do not reset ownership on corruption; fail closed and retain private data.
    throw new PushError('invalid-push-store');
  }
  return stored;
}

export function savePushStore(storage, store) {
  return storage.put(PUSH_STORE_KEY, store);
}

function checkId(id) {
  if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new PushError('invalid-player');
}

function copy(store) { return structuredClone(store); }

function requireOwner(store, playerId) {
  checkId(playerId);
  if (!Object.hasOwn(store.owners, playerId)) throw new PushError('owner-required', 'Reconnect before changing notifications.');
  return store.owners[playerId];
}

/** The browser creates a 32-byte random secret and keeps it alongside its UUID.
 * Only its SHA-256 digest is persisted. Public player IDs cannot change push data.
 * Room must call this with the supplied secret before authorizing any push action.
 */
export async function claimDevice(store, playerId, ownerSecret, now = Date.now()) {
  checkId(playerId);
  let secret;
  try { secret = fromBase64Url(ownerSecret, 32); }
  catch { throw new PushError('invalid-owner', 'This device needs a notification identity.'); }
  const digest = toBase64Url(await crypto.subtle.digest('SHA-256', secret));
  const previous = Object.hasOwn(store.owners, playerId) ? store.owners[playerId] : null;
  if (previous) {
    let mismatch = previous.secretHash.length ^ digest.length;
    for (let index = 0; index < digest.length; index++) mismatch |= digest.charCodeAt(index) ^ (previous.secretHash.charCodeAt(index) || 0);
    if (mismatch) throw new PushError('owner-mismatch', 'This player belongs to another device.');
  }
  const next = copy(store);
  if (!previous && Object.keys(next.owners).length >= MAX_OWNERS) {
    // A room can have only 64 subscriptions. Bound unused device history while
    // preserving every subscribed owner and every in-flight notification.
    const removable = Object.entries(next.owners)
      .filter(([id]) => !next.subscriptions[id] && !next.outbox.some(job => job.playerId === id))
      .sort((a, b) => a[1].lastSeenAt - b[1].lastSeenAt)[0];
    if (!removable) throw new PushError('push-capacity', 'Notification capacity has been reached.');
    delete next.owners[removable[0]];
  }
  next.owners[playerId] = previous
    ? { ...previous, lastSeenAt: now }
    : { secretHash: digest, createdAt: now, lastSeenAt: now, lastTurnToken: null, lastTestAt: null, lastStatus: 'disabled' };
  return next;
}

/** Safe for a private response to this player after verifying ownership. */
export function pushStatus(store, playerId) {
  const owner = Object.hasOwn(store.owners, playerId) ? store.owners[playerId] : null;
  return { enabled: Boolean(Object.hasOwn(store.subscriptions, playerId)), status: owner?.lastStatus ?? 'disabled' };
}

/** Caller must have authenticated the socket with claimDevice. One subscription
 * per player, with an opaque revision ID so a late response cannot erase a replacement.
 */
export async function subscribe(store, playerId, input, now = Date.now()) {
  requireOwner(store, playerId);
  const subscription = await validatePushSubscription(input, now);
  for (const [id, record] of Object.entries(store.subscriptions)) {
    if (id !== playerId && record.subscription.endpoint === subscription.endpoint) {
      throw new PushError('subscription-owned', 'This browser is already subscribed as another player.');
    }
  }
  if (!store.subscriptions[playerId] && Object.keys(store.subscriptions).length >= MAX_SUBSCRIPTIONS) {
    throw new PushError('push-capacity', 'Notification capacity has been reached.');
  }
  const next = copy(store);
  const previous = next.subscriptions[playerId];
  const unchanged = previous && JSON.stringify(previous.subscription) === JSON.stringify(subscription);
  next.subscriptions[playerId] = {
    id: unchanged ? previous.id : crypto.randomUUID(),
    subscription,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  if (!unchanged) next.outbox = next.outbox.filter(job => job.playerId !== playerId);
  next.owners[playerId].lastStatus = 'enabled';
  return next;
}

export function unsubscribe(store, playerId) {
  requireOwner(store, playerId);
  const next = copy(store);
  delete next.subscriptions[playerId];
  next.outbox = next.outbox.filter(job => job.playerId !== playerId);
  next.owners[playerId].lastStatus = 'disabled';
  return next;
}

function cleanJobs(store, now) {
  const exhaustedPlayers = new Set();
  store.outbox = store.outbox.filter(job => {
    if (store.subscriptions[job.playerId]?.id !== job.subscriptionId) return false;
    if (job.expiresAt <= now || (job.attempts >= MAX_PUSH_ATTEMPTS && job.dueAt <= now)) {
      exhaustedPlayers.add(job.playerId);
      return false;
    }
    return true;
  });
  for (const playerId of exhaustedPlayers) {
    const owner = store.owners[playerId];
    if (owner && !store.outbox.some(job => job.playerId === playerId) && ['queued', 'retrying'].includes(owner.lastStatus)) {
      owner.lastStatus = 'failed';
    }
  }
}

function checkPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || encoder.encode(JSON.stringify(payload)).length > 3000) {
    throw new PushError('invalid-payload');
  }
}

function makeJob(kind, record, playerId, payload, now, expiresAt, turnToken = null) {
  return {
    id: crypto.randomUUID(), kind, playerId, subscriptionId: record.id,
    payload: { ...structuredClone(payload), kind, expiresAt },
    topic: kind === 'turn' ? 'hangman-turn' : 'hangman-test',
    turnToken, createdAt: now, expiresAt, dueAt: now, attempts: 0,
  };
}

/** Invoke only for a new actionable turn. Dedup is retained after success/failure,
 * including across hibernation/restarts. Never send a round's clue or answer.
 */
export function queueTurn(store, { turnToken, playerId, payload, expiresAt }, now = Date.now()) {
  const next = copy(store);
  cleanJobs(next, now);
  if (!playerId || !Object.hasOwn(next.owners, playerId)) return next;
  if (typeof turnToken !== 'string' || turnToken.length > 160 || turnToken.length < 1) throw new PushError('invalid-turn-token');
  if (next.owners[playerId].lastTurnToken === turnToken) return next;
  next.owners[playerId].lastTurnToken = turnToken;
  const record = next.subscriptions[playerId];
  if (!record) return next;
  checkPayload(payload);
  const end = Math.min(Number.isFinite(expiresAt) ? expiresAt : now + 60_000, now + MAX_JOB_LIFETIME_MS);
  if (end <= now) return next;
  next.outbox = next.outbox.filter(job => job.kind !== 'turn');
  if (next.outbox.length >= MAX_OUTBOX) throw new PushError('outbox-capacity');
  next.outbox.push(makeJob('turn', record, playerId, { ...payload, turnToken }, now, end, turnToken));
  next.owners[playerId].lastStatus = 'queued';
  return next;
}

export function queueTest(store, { playerId, payload }, now = Date.now()) {
  const owner = requireOwner(store, playerId);
  if (!store.subscriptions[playerId]) throw new PushError('not-subscribed', 'Enable notifications first.');
  if (owner.lastTestAt !== null && now - owner.lastTestAt < TEST_INTERVAL_MS) {
    throw new PushError('test-rate-limit', 'Wait a minute before sending another test.');
  }
  checkPayload(payload);
  const next = copy(store);
  cleanJobs(next, now);
  next.outbox = next.outbox.filter(job => !(job.kind === 'test' && job.playerId === playerId));
  if (next.outbox.length >= MAX_OUTBOX) throw new PushError('outbox-capacity');
  next.outbox.push(makeJob('test', next.subscriptions[playerId], playerId, payload, now, now + 60_000));
  next.owners[playerId].lastTestAt = now;
  next.owners[playerId].lastStatus = 'queued';
  return next;
}

export function pruneTurnJobs(store, { turnToken, paused, activePlayerId }, now = Date.now()) {
  const next = copy(store);
  cleanJobs(next, now);
  next.outbox = next.outbox.filter(job => job.kind !== 'turn' ||
    (!paused && job.turnToken === turnToken && job.playerId === activePlayerId));
  return next;
}

/** Read-only preview. Actual senders must use claimDueTasks then persist its store. */
export function dueTasks(store, now = Date.now(), limit = 4) {
  return store.outbox
    .filter(job => job.dueAt <= now && job.expiresAt > now && job.attempts < MAX_PUSH_ATTEMPTS &&
      store.subscriptions[job.playerId]?.id === job.subscriptionId)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, Math.max(0, Math.min(limit, 4)))
    .map(job => ({ ...structuredClone(job), subscription: structuredClone(store.subscriptions[job.playerId].subscription) }));
}

/** Claim and persist BEFORE the network request. A 30s lease permits recovery
 * after process loss, and every claim consumes one of the three attempts.
 * Providers and service workers coalesce by topic/tag: HTTP cannot offer exactly
 * once delivery across a crash after acceptance but before the result is stored.
 */
export function claimDueTasks(store, now = Date.now(), limit = 4) {
  const next = copy(store);
  cleanJobs(next, now);
  const candidates = dueTasks(next, now, limit);
  const tasks = candidates.map(candidate => {
    const job = next.outbox.find(item => item.id === candidate.id);
    job.attempts += 1;
    job.dueAt = Math.min(now + LEASE_MS, job.expiresAt);
    return { ...structuredClone(job), subscription: candidate.subscription };
  });
  return { store: next, tasks };
}

export function nextRetryAt(store) {
  if (!store.outbox.length) return null;
  return Math.min(...store.outbox.map(job => Math.min(job.dueAt, job.expiresAt)));
}

/** Ignore stale task/attempt completions, especially after unsubscribe/replacement.
 * 404/410 drop the exact failed subscription. Other permanent errors keep the
 * user's opt-in, but stop this job. Transient failures retry at most three times.
 */
export function completeTask(store, jobId, result, now = Date.now(), attempt) {
  const existing = store.outbox.find(job => job.id === jobId);
  if (!existing || (attempt !== undefined && attempt !== existing.attempts)) return store;
  const next = copy(store);
  const job = next.outbox.find(item => item.id === jobId);
  const current = next.subscriptions[job.playerId];
  if (!current || current.id !== job.subscriptionId) {
    next.outbox = next.outbox.filter(item => item.id !== jobId);
    return next;
  }
  const owner = next.owners[job.playerId];
  if (result.expired) {
    delete next.subscriptions[job.playerId];
    next.outbox = next.outbox.filter(item => item.playerId !== job.playerId);
    if (owner) owner.lastStatus = 'expired';
  } else if (result.ok) {
    next.outbox = next.outbox.filter(item => item.id !== jobId);
    if (owner) owner.lastStatus = 'sent';
  } else {
    const suggested = Number.isFinite(result.retryAfterMs) ? result.retryAfterMs : 5000;
    const delay = Math.max(1000, Math.min(24 * 60 * 60_000, Math.max(suggested, 5000 * (2 ** Math.max(0, job.attempts - 1)))));
    if (result.retryable && job.attempts < MAX_PUSH_ATTEMPTS && now + delay < job.expiresAt) {
      job.dueAt = now + delay;
      if (owner) owner.lastStatus = 'retrying';
    } else {
      next.outbox = next.outbox.filter(item => item.id !== jobId);
      if (owner) owner.lastStatus = 'failed';
    }
  }
  return next;
}
