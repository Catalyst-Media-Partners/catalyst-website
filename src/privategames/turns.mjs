export const RECONNECT_GRACE_MS = 12_000;
export const PUSH_IDLE_MS = 30 * 60_000;
export const ROOM_IDLE_MS = 30 * 60_000;
export const VOTE_FALLBACK_MS = 90_000;
export const MAX_PLAYERS = 64;
const freshToken = () => globalThis.crypto.randomUUID();
const byEntry = (left, right) => left.entryOrder - right.entryOrder;
const sameIds = (left, right) => left.length === right.length && left.every((id, index) => id === right[index]);
const copy = turn => ({ ...turn,
  order: turn.order.map(player => ({ ...player })),
  waiting: turn.waiting.map(player => ({ ...player })),
  vote: { ...turn.vote, eligibleIds: [...turn.vote.eligibleIds], voterIds: [...turn.vote.voterIds] },
});
const emptyVote = targetId => ({ targetId: targetId || null, eligibleIds: [], voterIds: [], required: 2 });
const retention = player => player.pushEnabled ? PUSH_IDLE_MS : RECONNECT_GRACE_MS;

export function createTurns(makeToken = freshToken, now = Date.now()) {
  return { cycle: 1, token: makeToken(), cursor: 0, started: false,
    nextEntry: 0, order: [], waiting: [], vote: emptyVote(null),
    deadlineAt: null, remainingMs: null, clockKind: null, paused: true,
    lastActivityAt: now, lastPass: null };
}

export function migrateTurns(turn, now = Date.now()) {
  return { ...createTurns(() => turn.token, now), ...turn,
    order: turn.order.map(player => ({ ...player, pushEnabled: false })),
    waiting: turn.waiting.map(player => ({ ...player, pushEnabled: false })),
    vote: emptyVote(turn.order[turn.cursor]?.id),
  };
}

function wrap(turn) {
  turn.order = [...turn.order, ...turn.waiting].sort(byEntry);
  turn.waiting = [];
  turn.cursor = 0;
  turn.cycle++;
  turn.started = false;
}

function resetClockAndVote(turn, makeToken) {
  turn.token = makeToken();
  turn.vote = emptyVote(turn.order[turn.cursor]?.id);
  turn.deadlineAt = null;
  turn.remainingMs = null;
  turn.clockKind = null;
}

export function advanceTurns(turn, makeToken = freshToken, { now = Date.now(), reason = null } = {}) {
  const next = copy(turn);
  const previous = next.order[next.cursor];
  next.started = true;
  next.cursor++;
  if (next.cursor >= next.order.length) wrap(next);
  if (!next.order.length) { next.cursor = 0; next.started = false; }
  if (reason && previous) next.lastPass = { playerId: previous.id, name: previous.name, reason, at: now };
  resetClockAndVote(next, makeToken);
  return next;
}

export function renewTurn(turn, makeToken = freshToken) {
  const next = copy(turn);
  resetClockAndVote(next, makeToken);
  return next;
}

function removeMatching(next, remove, makeToken, now) {
  const previousOrder = next.order;
  const current = previousOrder[next.cursor];
  const survivingPrefix = previousOrder.slice(0, next.cursor).filter(player => !remove(player)).length;
  next.order = previousOrder.filter(player => !remove(player));
  const waitingLength = next.waiting.length;
  next.waiting = next.waiting.filter(player => !remove(player));
  const changed = next.order.length !== previousOrder.length || next.waiting.length !== waitingLength;
  if (current && remove(current)) {
    next.cursor = survivingPrefix;
    next.started = true;
    if (next.cursor >= next.order.length) wrap(next);
    next.lastPass = { playerId: current.id, name: current.name, reason: 'offline', at: now };
    resetClockAndVote(next, makeToken);
  } else if (current) {
    next.cursor = next.order.findIndex(player => player.id === current.id);
  } else if (!next.order.length && next.waiting.length) {
    wrap(next);
    resetClockAndVote(next, makeToken);
  }
  if (!next.order.length) { next.cursor = 0; next.started = false; }
  // Removing an elector never turns an old minority ballot into a pass. The
  // current turn survives, but its peers must cast a new ballot.
  if (changed && next.vote.eligibleIds.some(id => !next.order.some(player => player.id === id))) {
    next.vote = emptyVote(next.order[next.cursor]?.id);
  }
  return changed;
}

export function removePlayer(turn, id, now, makeToken = freshToken) {
  const next = copy(turn);
  const changed = removeMatching(next, player => player.id === id, makeToken, now);
  return { turn: changed ? next : turn, changed };
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
  const expired = player => player.disconnectedAt !== null && now >= player.disconnectedAt + retention(player);
  changed = removeMatching(next, expired, makeToken, now) || changed;
  return { turn: changed ? next : turn, changed };
}

export function joinTurn(turn, { id, name, entryOrder, pushEnabled = false }, makeToken = freshToken) {
  const next = copy(turn);
  const existing = [...next.order, ...next.waiting].find(player => player.id === id);
  if (existing) {
    const changed = existing.name !== name || existing.disconnectedAt !== null || existing.pushEnabled !== pushEnabled;
    existing.name = name;
    existing.disconnectedAt = null;
    existing.pushEnabled = pushEnabled;
    return { turn: changed ? next : turn, changed };
  }
  if (next.order.length + next.waiting.length >= MAX_PLAYERS) return { turn, changed: false, code: 'room_full' };
  const player = { id, name, entryOrder, disconnectedAt: null, pushEnabled };
  if (!next.order.length || !next.started) {
    const previousCurrent = next.order[next.cursor]?.id;
    next.order.push(player);
    next.order.sort(byEntry);
    next.cursor = 0;
    if (previousCurrent !== next.order[0]?.id) resetClockAndVote(next, makeToken);
  } else {
    next.waiting.push(player);
    next.waiting.sort(byEntry);
  }
  return { turn: next, changed: true };
}

export function setPushPreference(turn, id, enabled) {
  const next = copy(turn);
  const player = [...next.order, ...next.waiting].find(member => member.id === id);
  if (!player || player.pushEnabled === enabled) return turn;
  player.pushEnabled = enabled;
  return next;
}

// The electorate remains editable until the first vote, then freezes until
// this turn ends or an elector explicitly leaves/expires from the roster.
// Clocks pause with no connected players, and stop after 30 minutes without a
// deliberate player action even if a forgotten browser keeps its socket open.
export function syncTurnRuntime(turn, connectedIds, settings, now, { activity = false } = {}) {
  const next = { ...turn, lastActivityAt: activity ? Math.max(turn.lastActivityAt, now) : turn.lastActivityAt };
  const current = next.order[next.cursor];
  const peers = next.order.filter(player => player.id !== current?.id && connectedIds.has(player.id)).map(player => player.id);
  const vote = next.vote;
  if (vote.targetId !== (current?.id || null) || !vote.voterIds.length) {
    if (vote.targetId !== (current?.id || null) || !sameIds(vote.eligibleIds, peers)) {
      next.vote = { targetId: current?.id || null, eligibleIds: peers, voterIds: [],
        required: Math.max(2, Math.floor(peers.length / 2) + 1) };
    }
  }
  // A waiting arrival also needs this cycle to finish. A lone remaining
  // incumbent must not strand that person for the full push retention window.
  const multiplayer = next.order.length >= 2 || next.waiting.length > 0;
  const kind = !multiplayer ? null : settings.turnMode === 'timer' ? 'timer'
    : (!connectedIds.has(current?.id) || peers.length < 2) ? 'vote' : null;
  const duration = kind === 'timer' ? settings.turnSeconds * 1000 : VOTE_FALLBACK_MS;
  next.paused = !current || !connectedIds.size || now >= next.lastActivityAt + ROOM_IDLE_MS;
  if (!kind) {
    next.deadlineAt = null; next.remainingMs = null; next.clockKind = null;
  } else if (next.paused) {
    next.remainingMs = turn.clockKind === kind
      ? (turn.deadlineAt === null ? turn.remainingMs ?? duration : Math.max(0, turn.deadlineAt - now))
      : duration;
    next.deadlineAt = null; next.clockKind = kind;
  } else {
    next.deadlineAt = turn.clockKind === kind && turn.deadlineAt !== null
      ? turn.deadlineAt : now + (turn.clockKind === kind ? turn.remainingMs ?? duration : duration);
    next.remainingMs = null; next.clockKind = kind;
  }
  return Object.keys(next).some(key => next[key] !== turn[key]) ? next : turn;
}

export function nextAlarmAt(turn) {
  const deadlines = [...turn.order, ...turn.waiting]
    .filter(player => player.disconnectedAt !== null)
    .map(player => player.disconnectedAt + retention(player));
  if (turn.deadlineAt !== null) deadlines.push(turn.deadlineAt, turn.lastActivityAt + ROOM_IDLE_MS);
  return deadlines.length ? Math.min(...deadlines) : null;
}

export function publicTurns(turn, connectedIds) {
  const current = turn.order[turn.cursor];
  const player = item => ({ id: item.id, name: item.name, connected: connectedIds.has(item.id), pushEnabled: item.pushEnabled });
  return {
    cycle: turn.cycle, token: turn.token,
    activePlayerId: current?.id || null, activePlayerName: current?.name || null,
    order: turn.order.map(player), waiting: turn.waiting.map(player),
    graceEndsAt: current?.disconnectedAt !== null && current?.disconnectedAt !== undefined
      ? current.disconnectedAt + retention(current) : null,
    vote: { ...turn.vote, eligibleIds: [...turn.vote.eligibleIds], voterIds: [...turn.vote.voterIds] },
    deadlineAt: turn.deadlineAt, paused: turn.paused,
    lastPass: turn.lastPass ? { ...turn.lastPass } : null,
  };
}

export function validTurns(turn, { legacy = false } = {}) {
  const uint = value => Number.isSafeInteger(value) && value >= 0;
  const validPlayer = player => player && typeof player.id === 'string' &&
    player.id.length > 0 && player.id.length <= 80 && typeof player.name === 'string' &&
    [...player.name].length > 0 && [...player.name].length <= 64 &&
    uint(player.entryOrder) && player.entryOrder > 0 && player.entryOrder <= turn.nextEntry &&
    (player.disconnectedAt === null || uint(player.disconnectedAt)) && (legacy || typeof player.pushEnabled === 'boolean');
  if (!turn || !uint(turn.cycle) || turn.cycle < 1 || typeof turn.token !== 'string' ||
    !turn.token.length || turn.token.length > 100 || !uint(turn.cursor) ||
    typeof turn.started !== 'boolean' || !uint(turn.nextEntry) ||
    !Array.isArray(turn.order) || !Array.isArray(turn.waiting) ||
    turn.order.length + turn.waiting.length > MAX_PLAYERS ||
    turn.cursor >= Math.max(1, turn.order.length)) return false;
  const all = [...turn.order, ...turn.waiting];
  if (!all.every(validPlayer) || new Set(all.map(player => player.id)).size !== all.length ||
    new Set(all.map(player => player.entryOrder)).size !== all.length) return false;
  if (legacy) return true;
  const ids = new Set(turn.order.map(player => player.id));
  const vote = turn.vote;
  const pass = turn.lastPass;
  return typeof turn.paused === 'boolean' && uint(turn.lastActivityAt) &&
    (turn.deadlineAt === null || uint(turn.deadlineAt)) &&
    (turn.remainingMs === null || uint(turn.remainingMs) && turn.remainingMs <= 120_000) &&
    [null, 'vote', 'timer'].includes(turn.clockKind) && (!turn.paused || turn.deadlineAt === null) &&
    vote && vote.targetId === (turn.order[turn.cursor]?.id || null) &&
    Array.isArray(vote.eligibleIds) && vote.eligibleIds.length <= MAX_PLAYERS &&
    vote.eligibleIds.every(id => ids.has(id) && id !== vote.targetId) &&
    new Set(vote.eligibleIds).size === vote.eligibleIds.length &&
    Array.isArray(vote.voterIds) && vote.voterIds.every(id => vote.eligibleIds.includes(id)) &&
    new Set(vote.voterIds).size === vote.voterIds.length &&
    vote.required === Math.max(2, Math.floor(vote.eligibleIds.length / 2) + 1) &&
    (pass === null || pass && typeof pass.playerId === 'string' && pass.playerId.length <= 80 &&
      typeof pass.name === 'string' && [...pass.name].length <= 64 &&
      ['voluntary', 'vote', 'timeout', 'offline'].includes(pass.reason) && uint(pass.at));
}
