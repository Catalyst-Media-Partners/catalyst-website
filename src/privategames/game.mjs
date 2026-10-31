import { WORD_BANK } from './words.mjs';
import { advanceTurns, createTurns, joinTurn, publicTurns, reconcileTurns, renewTurn, validTurns } from './turns.mjs';

export const MAX_STRIKES = 10;
export const SCHEMA_VERSION = 2;
export { WORD_BANK };

const nextId = () => globalThis.crypto.randomUUID();
const noChange = (state, code) => ({ state, changed: false, code });

function nextRound(previous, { now, random, makeRoundId, makeTurnToken }) {
  let bag = previous.bag.filter(word => WORD_BANK.some(entry => entry.word === word));
  if (!bag.length) {
    bag = WORD_BANK.map(entry => entry.word);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    if (bag.at(-1) === previous.word) {
      [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
    }
  }
  const word = bag.pop();
  const entry = WORD_BANK.find(candidate => candidate.word === word);
  return {
    ...previous,
    schemaVersion: SCHEMA_VERSION,
    roundId: makeRoundId(),
    revision: previous.revision + 1,
    roundNumber: previous.roundNumber + 1,
    word: entry.word,
    clue: entry.clue,
    bag,
    guesses: [],
    strikes: 0,
    status: 'playing',
    clueShown: previous.clueEnabled,
    turn: renewTurn(previous.turn, makeTurnToken),
    wins: previous.wins,
    losses: previous.losses,
    updatedAt: Math.max(now, previous.updatedAt),
  };
}

export function createGame({ now = Date.now(), random = Math.random, makeRoundId = nextId, makeTurnToken = nextId } = {}) {
  return nextRound({
    bag: [], word: null, revision: 0, roundNumber: 0,
    wins: 0, losses: 0, updatedAt: 0, clueEnabled: false, turn: createTurns(makeTurnToken),
  }, { now, random, makeRoundId, makeTurnToken });
}

const touch = (state, fields, now) => ({ ...state, ...fields,
  revision: state.revision + 1, updatedAt: Math.max(now, state.updatedAt) });

export function reserveEntry(state, now = Date.now()) {
  return touch(state, { turn: { ...state.turn, nextEntry: state.turn.nextEntry + 1 } }, now);
}

export function refreshPlayers(state, connectedIds, { now = Date.now(), makeTurnToken = nextId } = {}) {
  const result = reconcileTurns(state.turn, connectedIds, now, makeTurnToken);
  return result.changed ? { state: touch(state, { turn: result.turn }, now), changed: true } : noChange(state);
}

export function joinPlayer(state, player, { now = Date.now(), makeTurnToken = nextId } = {}) {
  const result = joinTurn(state.turn, player, makeTurnToken);
  return result.changed ? { state: touch(state, { turn: result.turn }, now), changed: true } : noChange(state, result.code);
}

export function migrateGame(state, { makeTurnToken = nextId } = {}) {
  if (state.schemaVersion === SCHEMA_VERSION) return assertStoredGame(state);
  assertGameFields(state, 1);
  return { ...state, schemaVersion: SCHEMA_VERSION, clueEnabled: state.clueShown,
    turn: createTurns(makeTurnToken), revision: state.revision + 1 };
}

// Pure transitions make an unsuccessful durable write safe: the accepted state
// remains unchanged until the storage operation has completed successfully.
export function applyAction(state, action, {
  playerId, now = Date.now(), random = Math.random, makeRoundId = nextId, makeTurnToken = nextId,
} = {}) {
  if (!action || typeof action !== 'object' || Array.isArray(action)) {
    return noChange(state, 'invalid_action');
  }
  if (!['guess', 'hint', 'next'].includes(action.type)) {
    return noChange(state, 'invalid_action');
  }
  if (typeof action.roundId !== 'string' || action.roundId !== state.roundId) {
    return noChange(state, 'stale_round');
  }
  if (action.type !== 'hint' && typeof action.turnToken !== 'string') {
    return noChange(state, 'client_update_required');
  }
  const player = state.turn.order.find(member => member.id === playerId);
  if (!player) return noChange(state,
    state.turn.waiting.some(member => member.id === playerId) ? 'waiting_for_cycle' : 'join_required');
  if (action.type !== 'hint') {
    if (action.turnToken !== state.turn.token) return noChange(state, 'stale_turn');
    if (state.turn.order[state.turn.cursor]?.id !== playerId) return noChange(state, 'out_of_turn');
  }
  if (action.type === 'next') {
    if (state.status === 'playing' && action.skip !== true) {
      return noChange(state, 'round_in_progress');
    }
    return { state: nextRound(state, { now, random, makeRoundId, makeTurnToken }), changed: true };
  }
  if (action.type === 'hint') {
    if (state.clueEnabled) return noChange(state);
    return {
      state: { ...state, clueShown: true, clueEnabled: true, revision: state.revision + 1,
        updatedAt: Math.max(now, state.updatedAt) },
      changed: true,
    };
  }
  if (typeof action.letter !== 'string' || !/^[a-z]$/i.test(action.letter)) {
    return noChange(state, 'invalid_letter');
  }
  if (state.status !== 'playing') return noChange(state, 'round_complete');
  const letter = action.letter.toUpperCase();
  if (state.guesses.some(guess => guess.letter === letter)) return noChange(state);
  const correct = state.word.toUpperCase().includes(letter);
  const guesses = [...state.guesses, { letter, correct, player: player.name, at: now }];
  const strikes = state.strikes + (correct ? 0 : 1);
  const solved = [...state.word.toUpperCase()].every(char => guesses.some(guess => guess.letter === char));
  const status = solved ? 'won' : strikes === MAX_STRIKES ? 'lost' : 'playing';
  return {
    state: {
      ...state, guesses, strikes, status,
      turn: advanceTurns(state.turn, makeTurnToken),
      wins: state.wins + (status === 'won' ? 1 : 0),
      losses: state.losses + (status === 'lost' ? 1 : 0),
      clueShown: state.clueShown || status !== 'playing',
      revision: state.revision + 1,
      updatedAt: Math.max(now, state.updatedAt),
    },
    changed: true,
  };
}

export function publicState(state, connectedIds = new Set()) {
  const guessed = new Set(state.guesses.map(guess => guess.letter));
  const finished = state.status !== 'playing';
  return {
    roundId: state.roundId,
    revision: state.revision,
    roundNumber: state.roundNumber,
    mask: [...state.word.toUpperCase()].map(letter => finished || guessed.has(letter) ? letter : null),
    length: state.word.length,
    strikes: state.strikes,
    maxStrikes: MAX_STRIKES,
    status: state.status,
    answer: finished ? state.word.toUpperCase() : null,
    guesses: state.guesses.map(guess => ({ letter: guess.letter, correct: guess.correct,
      player: guess.player, at: guess.at })),
    wins: state.wins,
    losses: state.losses,
    clue: state.clueShown ? state.clue : null,
    clueShown: state.clueShown,
    updatedAt: state.updatedAt,
    turn: publicTurns(state.turn, connectedIds),
  };
}

// A future or damaged record must fail visibly, never silently reset the room.
function assertGameFields(state, schemaVersion) {
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const word = value => typeof value === 'string' && /^[a-z]{1,15}$/.test(value);
  const valid = state && state.schemaVersion === schemaVersion &&
    typeof state.roundId === 'string' && state.roundId.length > 0 && state.roundId.length <= 100 &&
    integer(state.revision) && state.revision >= 1 &&
    integer(state.roundNumber) && state.roundNumber >= 1 &&
    word(state.word) && typeof state.clue === 'string' && state.clue.length <= 250 &&
    Array.isArray(state.bag) && state.bag.length <= WORD_BANK.length && state.bag.every(word) &&
    new Set(state.bag).size === state.bag.length &&
    Array.isArray(state.guesses) && state.guesses.length <= 26 &&
    state.guesses.every(guess => /^[A-Z]$/.test(guess.letter) &&
      typeof guess.correct === 'boolean' && typeof guess.player === 'string' &&
      [...guess.player].length <= 24 && integer(guess.at)) &&
    new Set(state.guesses.map(guess => guess.letter)).size === state.guesses.length &&
    integer(state.strikes) && state.strikes <= MAX_STRIKES &&
    state.strikes === state.guesses.filter(guess => !guess.correct).length &&
    ['playing', 'won', 'lost'].includes(state.status) &&
    typeof state.clueShown === 'boolean' &&
    integer(state.wins) && integer(state.losses) && integer(state.updatedAt);
  const guessLetters = valid ? new Set(state.guesses.map(guess => guess.letter)) : new Set();
  const solved = valid && [...state.word.toUpperCase()].every(letter => guessLetters.has(letter));
  const expectedStatus = solved ? 'won' : state?.strikes === MAX_STRIKES ? 'lost' : 'playing';
  if (!valid || state.status !== expectedStatus ||
    state.guesses.some(guess => guess.correct !== state.word.toUpperCase().includes(guess.letter)) ||
    (state.status !== 'playing' && !state.clueShown)) {
    throw new Error('Unsupported or damaged privategames state; refusing to overwrite it.');
  }
  return state;
}

export function assertStoredGame(state) {
  assertGameFields(state, SCHEMA_VERSION);
  if (typeof state.clueEnabled !== 'boolean' || (state.clueEnabled && !state.clueShown) || !validTurns(state.turn)) {
    throw new Error('Unsupported or damaged privategames turn state; refusing to overwrite it.');
  }
  return state;
}
