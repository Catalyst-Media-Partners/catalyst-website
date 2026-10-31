import { WORD_BANK } from './words.mjs';

export const MAX_STRIKES = 10;
export const SCHEMA_VERSION = 1;
export { WORD_BANK };

const nextId = () => globalThis.crypto.randomUUID();
const noChange = (state, code) => ({ state, changed: false, code });

function nextRound(previous, { now, random, makeRoundId }) {
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
    clueShown: false,
    wins: previous.wins,
    losses: previous.losses,
    updatedAt: Math.max(now, previous.updatedAt),
  };
}

export function createGame({ now = Date.now(), random = Math.random, makeRoundId = nextId } = {}) {
  return nextRound({
    bag: [], word: null, revision: 0, roundNumber: 0,
    wins: 0, losses: 0, updatedAt: 0,
  }, { now, random, makeRoundId });
}

// Pure transitions make an unsuccessful durable write safe: the accepted state
// remains unchanged until the storage operation has completed successfully.
export function applyAction(state, action, {
  player = 'Guest', now = Date.now(), random = Math.random, makeRoundId = nextId,
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
  if (action.type === 'next') {
    if (state.status === 'playing' && action.skip !== true) {
      return noChange(state, 'round_in_progress');
    }
    return { state: nextRound(state, { now, random, makeRoundId }), changed: true };
  }
  if (action.type === 'hint') {
    if (state.clueShown) return noChange(state);
    return {
      state: { ...state, clueShown: true, revision: state.revision + 1,
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
  const guesses = [...state.guesses, { letter, correct, player, at: now }];
  const strikes = state.strikes + (correct ? 0 : 1);
  const solved = [...state.word.toUpperCase()].every(char => guesses.some(guess => guess.letter === char));
  const status = solved ? 'won' : strikes === MAX_STRIKES ? 'lost' : 'playing';
  return {
    state: {
      ...state, guesses, strikes, status,
      wins: state.wins + (status === 'won' ? 1 : 0),
      losses: state.losses + (status === 'lost' ? 1 : 0),
      clueShown: state.clueShown || status !== 'playing',
      revision: state.revision + 1,
      updatedAt: Math.max(now, state.updatedAt),
    },
    changed: true,
  };
}

export function publicState(state) {
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
  };
}

// A future or damaged record must fail visibly, never silently reset the room.
export function assertStoredGame(state) {
  const integer = value => Number.isSafeInteger(value) && value >= 0;
  const word = value => typeof value === 'string' && /^[a-z]{1,15}$/.test(value);
  const valid = state && state.schemaVersion === SCHEMA_VERSION &&
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
