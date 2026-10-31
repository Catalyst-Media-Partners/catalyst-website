import { WORD_BANK } from './words.mjs';
import { normalizeWordSettings, pickWord } from './dictionary.mjs';
import { pickPhrase, getPhrasePool } from './phrases.mjs';
import { advanceTurns, createTurns, joinTurn, migrateTurns, publicTurns, reconcileTurns,
  removePlayer, renewTurn, setPushPreference, syncTurnRuntime, validTurns } from './turns.mjs';

export const MAX_STRIKES = 10;
export const SCHEMA_VERSION = 3;
export const RECENT_WORD_LIMIT = 100;
export const DEFAULT_SETTINGS = Object.freeze({ vocabulary: 'middle', minLength: 3, maxLength: 15,
  turnMode: 'vote', turnSeconds: 90, puzzleMode: 'word' });
export { WORD_BANK };

const nextId = () => globalThis.crypto.randomUUID();
const noChange = (state, code) => ({ state, changed: false, code });
const onlineFromTurn = turn => new Set([...turn.order, ...turn.waiting]
  .filter(player => player.disconnectedAt === null).map(player => player.id));
const touch = (state, fields, now) => ({ ...state, ...fields,
  revision: state.revision + 1, updatedAt: Math.max(now, state.updatedAt) });

export function normalizeGameSettings(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RangeError('Invalid settings');
  const settings = { ...DEFAULT_SETTINGS, ...input };
  const words = normalizeWordSettings({ vocabulary: settings.vocabulary,
    minLength: settings.minLength, maxLength: settings.maxLength });
  if (!['word', 'phrase', 'mixed'].includes(settings.puzzleMode) ||
       !['vote', 'timer'].includes(settings.turnMode) || ![60, 90, 120].includes(settings.turnSeconds)) {
    throw new RangeError('Invalid turn settings');
  }
  if (settings.puzzleMode === 'phrase' && !getPhrasePool(settings.vocabulary).length) throw new RangeError('No matching phrases');
  return { ...words, turnMode: settings.turnMode, turnSeconds: settings.turnSeconds, puzzleMode: settings.puzzleMode };
}

function nextRound(previous, { now, random, makeRoundId, makeTurnToken, connectedIds, settings = previous.settings }) {
  const phrase = settings.puzzleMode === 'phrase' || (settings.puzzleMode === 'mixed' && random() < 0.5);
  const entry = phrase ? pickPhrase(settings.vocabulary, { random, excludeWords: previous.recentWords || [] })
    : pickWord(settings, { random, excludeWords: previous.recentWords || [] });
  const next = {
    ...previous, schemaVersion: SCHEMA_VERSION,
    roundId: makeRoundId(), revision: previous.revision + 1, roundNumber: previous.roundNumber + 1,
    word: entry.word, clue: entry.clue, bag: [],
    recentWords: [...(previous.recentWords || []), entry.word].slice(-RECENT_WORD_LIMIT), settings,
    guesses: [], strikes: 0, status: 'playing', clueShown: false, clueEnabled: false,
    turn: renewTurn(previous.turn, makeTurnToken),
    wins: previous.wins, losses: previous.losses, updatedAt: Math.max(now, previous.updatedAt),
  };
  next.turn = syncTurnRuntime(next.turn, connectedIds || onlineFromTurn(next.turn), settings, now, { activity: true });
  return next;
}

export function createGame({ now = Date.now(), random = Math.random, makeRoundId = nextId,
  makeTurnToken = nextId, settings = DEFAULT_SETTINGS } = {}) {
  return nextRound({
    bag: [], recentWords: [], word: null, revision: 0, roundNumber: 0,
    wins: 0, losses: 0, updatedAt: 0, clueEnabled: false,
    turn: createTurns(makeTurnToken, now), settings: normalizeGameSettings(settings),
  }, { now, random, makeRoundId, makeTurnToken });
}

export function reserveEntry(state, now = Date.now()) {
  return touch(state, { turn: { ...state.turn, nextEntry: state.turn.nextEntry + 1 } }, now);
}

export function refreshPlayers(state, connectedIds, { now = Date.now(), makeTurnToken = nextId } = {}) {
  const reconciled = reconcileTurns(state.turn, connectedIds, now, makeTurnToken);
  let turn = syncTurnRuntime(reconciled.turn, connectedIds, state.settings, now);
  if (!turn.paused && turn.deadlineAt !== null && now >= turn.deadlineAt) {
    const current = turn.order[turn.cursor];
    turn = advanceTurns(turn, makeTurnToken, { now, reason: connectedIds.has(current?.id) ? 'timeout' : 'offline' });
    turn = syncTurnRuntime(turn, connectedIds, state.settings, now);
  }
  return turn !== state.turn ? { state: touch(state, { turn }, now), changed: true } : noChange(state);
}

export function joinPlayer(state, player, { now = Date.now(), makeTurnToken = nextId,
  connectedIds = onlineFromTurn(state.turn), activity = true } = {}) {
  const result = joinTurn(state.turn, player, makeTurnToken);
  if (result.code) return noChange(state, result.code);
  const online = new Set(connectedIds); online.add(player.id);
  const turn = syncTurnRuntime(result.turn, online, state.settings, now, { activity });
  return turn !== state.turn ? { state: touch(state, { turn }, now), changed: true } : noChange(state);
}

export function updatePushPreference(state, playerId, enabled, { now = Date.now(),
  connectedIds = onlineFromTurn(state.turn) } = {}) {
  const next = setPushPreference(state.turn, playerId, enabled);
  if (next === state.turn) return noChange(state);
  const turn = syncTurnRuntime(next, connectedIds, state.settings, now);
  return { state: touch(state, { turn }, now), changed: true };
}

export function migrateGame(state, { makeTurnToken = nextId, now = Date.now() } = {}) {
  if (state.schemaVersion === SCHEMA_VERSION) return assertStoredGame(state);
  if (state.schemaVersion !== 1 && state.schemaVersion !== 2) {
    throw new Error('Unsupported or damaged privategames state; refusing to overwrite it.');
  }
  assertGameFields(state, state.schemaVersion);
  if (state.schemaVersion === 2 && (!validTurns(state.turn, { legacy: true }) ||
    typeof state.clueEnabled !== 'boolean' || state.clueEnabled && !state.clueShown)) {
    throw new Error('Unsupported or damaged privategames turn state; refusing to overwrite it.');
  }
  return { ...state, schemaVersion: SCHEMA_VERSION,
    clueEnabled: state.schemaVersion === 1 ? state.clueShown : state.clueEnabled,
    settings: { ...DEFAULT_SETTINGS }, recentWords: [state.word],
    turn: state.schemaVersion === 1 ? createTurns(makeTurnToken, now) : migrateTurns(state.turn, now),
    revision: state.revision + 1 };
}

// Pure transitions leave the accepted state untouched if a durable write fails.
export function applyAction(state, action, {
  playerId, now = Date.now(), random = Math.random, makeRoundId = nextId, makeTurnToken = nextId,
  connectedIds = onlineFromTurn(state.turn),
} = {}) {
  if (!action || typeof action !== 'object' || Array.isArray(action) ||
    !['guess', 'hint', 'next', 'pass', 'voteSkip', 'leave'].includes(action.type)) {
    return noChange(state, 'invalid_action');
  }
  if (typeof action.roundId !== 'string' || action.roundId !== state.roundId) return noChange(state, 'stale_round');
  if (action.type !== 'hint' && typeof action.turnToken !== 'string') return noChange(state, 'client_update_required');
  const player = state.turn.order.find(member => member.id === playerId);
  const waiting = state.turn.waiting.find(member => member.id === playerId);
  if (!player && !(action.type === 'leave' && waiting)) return noChange(state, waiting ? 'waiting_for_cycle' : 'join_required');
  if (action.type !== 'hint' && action.turnToken !== state.turn.token) return noChange(state, 'stale_turn');
  const currentId = state.turn.order[state.turn.cursor]?.id;
  if (['guess', 'next', 'pass'].includes(action.type) && currentId !== playerId) return noChange(state, 'out_of_turn');
  if (action.type === 'leave') {
    const result = removePlayer(state.turn, playerId, now, makeTurnToken);
    const online = new Set(connectedIds); online.delete(playerId);
    const turn = syncTurnRuntime(result.turn, online, state.settings, now, { activity: true });
    return { state: touch(state, { turn }, now), changed: true, left: true };
  }
  if (action.type === 'next') {
    if (state.status === 'playing' && action.skip !== true) return noChange(state, 'round_in_progress');
    let settings;
    try { settings = action.settings === undefined ? state.settings : normalizeGameSettings({ ...state.settings, ...action.settings }); }
    catch { return noChange(state, 'invalid_settings'); }
    if (action.settings !== undefined && (!action.settings || typeof action.settings !== 'object' || Array.isArray(action.settings))) {
      return noChange(state, 'invalid_settings');
    }
    return { state: nextRound(state, { now, random, makeRoundId, makeTurnToken, connectedIds, settings }), changed: true };
  }
  if (action.type === 'pass') {
    const turn = syncTurnRuntime(advanceTurns(state.turn, makeTurnToken, { now, reason: 'voluntary' }),
      connectedIds, state.settings, now, { activity: true });
    return { state: touch(state, { turn }, now), changed: true };
  }
  if (action.type === 'voteSkip') {
    if (state.settings.turnMode !== 'vote') return noChange(state, 'vote_disabled');
    if (playerId === currentId) return noChange(state, 'vote_own_turn');
    let turn = syncTurnRuntime(state.turn, connectedIds, state.settings, now);
    if (!turn.vote.eligibleIds.includes(playerId) || !connectedIds.has(playerId)) return noChange(state, 'vote_ineligible');
    if (turn.vote.eligibleIds.length < 2) return noChange(state, 'not_enough_voters');
    if (turn.vote.voterIds.includes(playerId)) return noChange(state);
    turn = { ...turn, vote: { ...turn.vote, voterIds: [...turn.vote.voterIds, playerId] } };
    if (turn.vote.voterIds.length >= turn.vote.required) {
      turn = advanceTurns(turn, makeTurnToken, { now, reason: 'vote' });
    }
    turn = syncTurnRuntime(turn, connectedIds, state.settings, now, { activity: true });
    return { state: touch(state, { turn }, now), changed: true };
  }
  if (action.type === 'hint') {
    if (state.clueShown) return noChange(state);
    const turn = syncTurnRuntime(state.turn, connectedIds, state.settings, now, { activity: true });
    return { state: touch(state, { clueShown: true, clueEnabled: true, turn }, now), changed: true };
  }
  if (typeof action.letter !== 'string' || !/^[a-z]$/i.test(action.letter)) return noChange(state, 'invalid_letter');
  if (state.status !== 'playing') return noChange(state, 'round_complete');
  const letter = action.letter.toUpperCase();
  if (state.guesses.some(guess => guess.letter === letter)) return noChange(state);
  const correct = state.word.toUpperCase().includes(letter);
  const guesses = [...state.guesses, { letter, correct, player: player.name, at: now }];
  const strikes = state.strikes + (correct ? 0 : 1);
  const solved = [...state.word.toUpperCase()].every(char => char === ' ' || guesses.some(guess => guess.letter === char));
  const status = solved ? 'won' : strikes === MAX_STRIKES ? 'lost' : 'playing';
  const turn = syncTurnRuntime(advanceTurns(state.turn, makeTurnToken), connectedIds, state.settings, now, { activity: true });
  return {
    state: touch(state, { guesses, strikes, status, turn,
      wins: state.wins + (status === 'won' ? 1 : 0), losses: state.losses + (status === 'lost' ? 1 : 0),
      clueShown: state.clueShown || status !== 'playing' }, now), changed: true,
  };
}

export function publicState(state, connectedIds = new Set()) {
  const guessed = new Set(state.guesses.map(guess => guess.letter));
  const finished = state.status !== 'playing';
  return {
    roundId: state.roundId, revision: state.revision, roundNumber: state.roundNumber,
    mask: [...state.word.toUpperCase()].map(letter => letter === ' ' || finished || guessed.has(letter) ? letter : null),
    length: state.word.length, strikes: state.strikes, maxStrikes: MAX_STRIKES, status: state.status,
    answer: finished ? state.word.toUpperCase() : null,
    guesses: state.guesses.map(guess => ({ letter: guess.letter, correct: guess.correct, player: guess.player, at: guess.at })),
    wins: state.wins, losses: state.losses, clue: state.clueShown ? state.clue : null,
    clueShown: state.clueShown, updatedAt: state.updatedAt,
    settings: { ...state.settings }, turn: publicTurns(state.turn, connectedIds),
  };
}

// A future or damaged record must fail visibly, never silently reset the room.
function assertGameFields(state, schemaVersion) {
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const word = value => typeof value === 'string' && (/^[a-z]{1,15}$/.test(value) ||
    /^[a-z]+(?: [a-z]+)+$/.test(value) && value.replace(/ /g, '').length <= 60 &&
    value.split(' ').every(part => part.length <= 15));
  const valid = state && state.schemaVersion === schemaVersion &&
    typeof state.roundId === 'string' && state.roundId.length > 0 && state.roundId.length <= 100 &&
    integer(state.revision) && state.revision >= 1 && integer(state.roundNumber) && state.roundNumber >= 1 &&
    word(state.word) && typeof state.clue === 'string' && state.clue.length <= 250 &&
    Array.isArray(state.bag) && state.bag.length <= WORD_BANK.length && state.bag.every(word) && new Set(state.bag).size === state.bag.length &&
    Array.isArray(state.guesses) && state.guesses.length <= 26 &&
    state.guesses.every(guess => /^[A-Z]$/.test(guess.letter) && typeof guess.correct === 'boolean' &&
      typeof guess.player === 'string' && [...guess.player].length <= 64 && integer(guess.at)) &&
    new Set(state.guesses.map(guess => guess.letter)).size === state.guesses.length &&
    integer(state.strikes) && state.strikes <= MAX_STRIKES && state.strikes === state.guesses.filter(guess => !guess.correct).length &&
    ['playing', 'won', 'lost'].includes(state.status) && typeof state.clueShown === 'boolean' &&
    integer(state.wins) && integer(state.losses) && integer(state.updatedAt);
  const guessLetters = valid ? new Set(state.guesses.map(guess => guess.letter)) : new Set();
  const solved = valid && [...state.word.toUpperCase()].every(letter => letter === ' ' || guessLetters.has(letter));
  const expectedStatus = solved ? 'won' : state?.strikes === MAX_STRIKES ? 'lost' : 'playing';
  if (!valid || state.status !== expectedStatus ||
    state.guesses.some(guess => guess.correct !== state.word.toUpperCase().includes(guess.letter)) ||
    (state.status !== 'playing' && !state.clueShown)) throw new Error('Unsupported or damaged privategames state; refusing to overwrite it.');
  return state;
}

export function assertStoredGame(state) {
  assertGameFields(state, SCHEMA_VERSION);
  let settings;
  try { settings = normalizeGameSettings(state.settings); } catch {}
  if (typeof state.clueEnabled !== 'boolean' || state.clueEnabled && !state.clueShown || !validTurns(state.turn) ||
    !settings || Object.keys(settings).some(key => settings[key] !== (key === 'puzzleMode' && state.settings[key] === undefined ? 'word' : state.settings[key])) ||
    !Array.isArray(state.recentWords) || state.recentWords.length > RECENT_WORD_LIMIT ||
    !state.recentWords.every(word)) {
    throw new Error('Unsupported or damaged privategames turn state; refusing to overwrite it.');
  }
  return state;
}
