export const RECONNECT_GRACE_MS = 12_000;
export const MAX_PLAYERS = 64;
const freshToken = () => globalThis.crypto.randomUUID();
const copy = turn => ({ ...turn,
  order: turn.order.map(player => ({ ...player })),
  waiting: turn.waiting.map(player => ({ ...player })),
});
const byEntry = (left, right) => left.entryOrder - right.entryOrder;

export function createTurns(makeToken = freshToken) {
  return { cycle: 1, token: makeToken(), cursor: 0, started: false,
    nextEntry: 0, order: [], waiting: [] };
}

function wrap(turn) {
  turn.order = [...turn.order, ...turn.waiting].sort(byEntry);
  turn.waiting = [];
  turn.cursor = 0;
  turn.cycle++;
  turn.started = false;
}

export function advanceTurns(turn, makeToken = freshToken) {
  const next = copy(turn);
  next.started = true;
  next.cursor++;
  if (next.cursor >= next.order.length) wrap(next);
  next.token = makeToken();
  return next;
}

export function renewTurn(turn, makeToken = freshToken) {
  return { ...turn, token: makeToken() };
}

export function reconcileTurns(turn, connectedIds, now, makeToken = freshToken) {
  const next = copy(turn);
  let changed = false;
  for (const player of [...next.order, ...next.waiting]) {
    if (connectedIds.has(player.id)) {
      if (player.disconnectedAt !== null) { player.disconnectedAt = null; changed = true; }
    } else if (player.disconnectedAt === null) {
      player.disconnectedAt = now;
      changed = true;
    }
  }
  const expired = player => player.disconnectedAt !== null &&
    now >= player.disconnectedAt + RECONNECT_GRACE_MS;
  const previousOrder = next.order;
  const current = previousOrder[next.cursor];
  const survivingPrefix = previousOrder.slice(0, next.cursor).filter(player => !expired(player)).length;
  next.order = previousOrder.filter(player => !expired(player));
  const waitingLength = next.waiting.length;
  next.waiting = next.waiting.filter(player => !expired(player));
  if (next.order.length !== previousOrder.length || next.waiting.length !== waitingLength) changed = true;
  if (current && expired(current)) {
    next.cursor = survivingPrefix;
    next.started = true;
    if (next.cursor >= next.order.length) wrap(next);
    next.token = makeToken();
  } else if (current) {
    next.cursor = next.order.findIndex(player => player.id === current.id);
  } else if (!next.order.length && next.waiting.length) {
    wrap(next);
    next.token = makeToken();
    changed = true;
  }
  if (!next.order.length) { next.cursor = 0; next.started = false; }
  return { turn: changed ? next : turn, changed };
}

export function joinTurn(turn, { id, name, entryOrder }, makeToken = freshToken) {
  const next = copy(turn);
  const existing = [...next.order, ...next.waiting].find(player => player.id === id);
  if (existing) {
    const changed = existing.name !== name || existing.disconnectedAt !== null;
    existing.name = name;
    existing.disconnectedAt = null;
    return { turn: changed ? next : turn, changed };
  }
  if (next.order.length + next.waiting.length >= MAX_PLAYERS) {
    return { turn, changed: false, code: 'room_full' };
  }
  const player = { id, name, entryOrder, disconnectedAt: null };
  if (!next.order.length || !next.started) {
    const previousCurrent = next.order[next.cursor]?.id;
    next.order.push(player);
    next.order.sort(byEntry);
    next.cursor = 0;
    if (previousCurrent !== next.order[0]?.id) next.token = makeToken();
  } else {
    next.waiting.push(player);
    next.waiting.sort(byEntry);
  }
  return { turn: next, changed: true };
}

export function nextAlarmAt(turn) {
  const deadlines = [...turn.order, ...turn.waiting]
    .filter(player => player.disconnectedAt !== null)
    .map(player => player.disconnectedAt + RECONNECT_GRACE_MS);
  return deadlines.length ? Math.min(...deadlines) : null;
}

export function publicTurns(turn, connectedIds) {
  const current = turn.order[turn.cursor];
  const player = item => ({ id: item.id, name: item.name, connected: connectedIds.has(item.id) });
  return {
    cycle: turn.cycle,
    token: turn.token,
    activePlayerId: current?.id || null,
    activePlayerName: current?.name || null,
    order: turn.order.map(player),
    waiting: turn.waiting.map(player),
    graceEndsAt: current?.disconnectedAt !== null && current?.disconnectedAt !== undefined
      ? current.disconnectedAt + RECONNECT_GRACE_MS : null,
  };
}

export function validTurns(turn) {
  const uint = value => Number.isSafeInteger(value) && value >= 0;
  const validPlayer = player => player && typeof player.id === 'string' &&
    player.id.length > 0 && player.id.length <= 80 && typeof player.name === 'string' &&
    [...player.name].length > 0 && [...player.name].length <= 24 &&
    uint(player.entryOrder) && player.entryOrder > 0 && player.entryOrder <= turn.nextEntry &&
    (player.disconnectedAt === null || uint(player.disconnectedAt));
  if (!turn || !uint(turn.cycle) || turn.cycle < 1 || typeof turn.token !== 'string' ||
    !turn.token.length || turn.token.length > 100 || !uint(turn.cursor) ||
    typeof turn.started !== 'boolean' || !uint(turn.nextEntry) ||
    !Array.isArray(turn.order) || !Array.isArray(turn.waiting) ||
    turn.order.length + turn.waiting.length > MAX_PLAYERS ||
    turn.cursor >= Math.max(1, turn.order.length)) return false;
  const all = [...turn.order, ...turn.waiting];
  return all.every(validPlayer) && new Set(all.map(player => player.id)).size === all.length &&
    new Set(all.map(player => player.entryOrder)).size === all.length;
}
