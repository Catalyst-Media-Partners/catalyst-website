(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const keys = new Map();
  const parts = [...document.querySelectorAll('.drawing-part')];
  let state = null, socket = null, live = false, pending = false;
  let retryTimer, heartbeatTimer, pendingTimer, noticeTimer, connectionTimer;
  let retry = 0, lastMessageAt = 0, stopped = false;
  const readStored = key => { try { return localStorage.getItem(key); } catch { return null; } };
  const writeStored = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
  let clientId = readStored('privategames.clientId');
  if (!clientId || !/^[a-zA-Z0-9-]{8,80}$/.test(clientId)) {
    clientId = crypto.randomUUID();
    writeStored('privategames.clientId', clientId);
  }
  let playerName = (readStored('privategames.name') || '').slice(0,24);
  el('player-name').value = playerName;

  function notice(message) {
    clearTimeout(noticeTimer);
    el('notice').textContent = message;
    el('notice').hidden = !message;
    if (message) noticeTimer = setTimeout(() => { el('notice').hidden = true; }, 9000);
  }

  function setConnection(connected, count) {
    live = connected;
    el('connection').className = 'connection ' + (connected ? 'live' : state ? 'offline' : '');
    el('connection-label').textContent = connected
      ? 'Live · ' + count + (count === 1 ? ' player' : ' players')
      : navigator.onLine ? 'Connecting…' : 'Offline · moves paused';
    el('room-note').textContent = connected
      ? 'Everyone at this link shares the same word, guesses, and score.'
      : state ? 'Reconnecting to the saved game. Your board will update automatically.'
      : 'Connecting to the shared game. Your moves are saved after every guess.';
    updateControls();
  }

  function updateControls() {
    const available = live && socket?.readyState === WebSocket.OPEN && state && !pending;
    const guessed = new Map((state?.guesses || []).map(g => [g.letter, g]));
    for (const [letter, button] of keys) {
      const guess = guessed.get(letter);
      button.disabled = !available || state.status !== 'playing' || guessed.has(letter);
      button.classList.toggle('correct', !!guess?.correct);
      button.classList.toggle('wrong', !!guess && !guess.correct);
      button.setAttribute('aria-label', letter + (guess ? guess.correct ? ', correct guess' : ', incorrect guess' : ', guess letter'));
    }
    el('hint-toggle').disabled = !available || state?.status !== 'playing';
    el('new-word').disabled = !available;
  }

  for (const letter of letters) {
    const key = document.createElement('button');
    key.type = 'button'; key.className = 'key'; key.textContent = letter; key.disabled = true;
    key.addEventListener('click', () => guess(letter));
    keys.set(letter, key); el('keyboard').appendChild(key);
  }
  for (let i=0;i<10;i++) {
    const pip = document.createElement('span'); pip.className = 'strike-pip';
    el('strike-track').appendChild(pip);
  }

  function renderState() {
    if (!state) { updateControls(); return; }
    const word = el('word');
    word.replaceChildren(); word.style.setProperty('--letters', state.length);
    word.classList.toggle('long', state.length > 11);
    const guesses = new Set(state.guesses.map(g => g.letter));
    const visible = state.answer ? [...state.answer] : state.mask;
    for (const letter of visible) {
      const tile = document.createElement('span');
      tile.className = 'letter' + (letter && guesses.has(letter) ? ' revealed' : letter && state.status === 'lost' ? ' missed' : '');
      tile.textContent = letter || '\u00a0'; word.appendChild(tile);
    }
    el('accessible-word').textContent = 'Word: ' + visible.map(l => l || 'blank').join(', ') + '.';
    el('word-length').textContent = state.length + ' letters';
    parts.forEach((part,i) => part.classList.toggle('visible', i < state.strikes));
    el('drawing-title').textContent = 'Hangman: ' + state.strikes + ' of 10 pieces drawn';
    el('idle-note').hidden = state.strikes > 0 || state.status !== 'playing';
    el('idle-note').textContent = state.guesses.length ? 'So far, so good.' : 'Make your first guess.';
    [...el('strike-track').children].forEach((pip,i) => pip.classList.toggle('used', i < state.strikes));
    const left = 10 - state.strikes;
    el('remaining').textContent = left + (left === 1 ? ' strike left' : ' strikes left');
    el('remaining').classList.toggle('danger', left <= 3 && state.status !== 'won');
    el('strike-count').textContent = state.strikes + ' / 10 strikes';
    el('wins').textContent = state.wins; el('losses').textContent = state.losses;
    el('status').className = 'status' + (state.status === 'won' ? ' win' : state.status === 'lost' ? ' loss' : '');
    el('new-word-label').textContent = state.status === 'playing' ? 'New random word' : 'Play another word';
    const last = state.guesses.at(-1);
    if (state.status === 'won') {
      el('status').textContent = 'Teamwork. You got it!';
      el('feedback').textContent = state.answer + ' — solved with ' + left + (left === 1 ? ' strike to spare.' : ' strikes to spare.');
    } else if (state.status === 'lost') {
      el('status').textContent = 'Out of guesses.';
      el('feedback').textContent = 'The word was ' + state.answer + '. Try another word together.';
    } else if (last) {
      el('status').textContent = last.correct ? 'Nice find.' : 'Keep thinking.';
      el('feedback').textContent = (last.player || 'A player') + ' guessed ' + last.letter + '. ' + (last.correct ? 'It is in the word.' : 'It is not in this word.');
    } else {
      el('status').textContent = 'Find the hidden word.';
      el('feedback').textContent = 'Round ' + state.roundNumber + ' · Choose a letter. Everyone plays together.';
    }
    const showClue = state.clueShown || state.status !== 'playing';
    el('hint-toggle').hidden = showClue;
    el('hint-toggle').setAttribute('aria-expanded', String(showClue));
    el('clue').hidden = !showClue;
    el('clue-text').textContent = state.clue || '';
    updateControls();
  }

  function applySnapshot(envelope, fromSocket) {
    if (envelope?.type !== 'state' || !envelope.state) return;
    const next = envelope.state;
    if (!Array.isArray(next.mask) || !Array.isArray(next.guesses) || next.length < 1 || next.length > 15) return;
    if (fromSocket) {
      pending = false; clearTimeout(pendingTimer);
      const players = Array.isArray(envelope.players) ? envelope.players : [];
      el('players').replaceChildren();
      for (const player of players.slice(0,12)) {
        const chip = document.createElement('span'); chip.className = 'player-chip';
        chip.textContent = (player.name || 'Guest') + (player.id === clientId ? ' (you)' : '');
        el('players').appendChild(chip);
      }
      if (players.length > 12) {
        const more = document.createElement('span'); more.textContent = '+' + (players.length - 12) + ' more';
        el('players').appendChild(more);
      }
      setConnection(true,players.length);
    }
    if (!state || next.revision > state.revision) {
      state = next; renderState();
    } else updateControls();
  }

  function sendAction(type, fields = {}) {
    if (!live || !state || pending || socket?.readyState !== WebSocket.OPEN) return;
    pending = true; updateControls();
    try { socket.send(JSON.stringify({type,roundId:state.roundId,...fields})); }
    catch { pending = false; socket.close(); return; }
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pending = false;
      notice('Connection interrupted. Reconnecting to check the saved game…');
      socket?.close();
    },8000);
  }

  function guess(letter) {
    if (!state || state.status !== 'playing' || !/^[A-Z]$/.test(letter) || state.guesses.some(g => g.letter === letter)) return;
    sendAction('guess',{letter});
  }

  function connect() {
    clearTimeout(retryTimer);
    if (stopped || socket && [WebSocket.OPEN,WebSocket.CONNECTING].includes(socket.readyState)) return;
    setConnection(false,0);
    const url = new URL('/privategames/api/socket', location.href);
    url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(url); socket = ws;
    connectionTimer = setTimeout(() => { if (ws.readyState !== WebSocket.OPEN) ws.close(); },10000);
    ws.addEventListener('open',() => {
      clearTimeout(connectionTimer); retry = 0; lastMessageAt = Date.now();
      ws.send(JSON.stringify({type:'join',clientId,name:playerName}));
      clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (ws !== socket || ws.readyState !== WebSocket.OPEN) return;
        if (Date.now() - lastMessageAt > 60000) { ws.close(); return; }
        ws.send('ping');
      },25000);
    });
    ws.addEventListener('message', event => {
      if (ws !== socket) return;
      lastMessageAt = Date.now();
      if (event.data === 'pong') return;
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.type === 'state') applySnapshot(message,true);
      if (message.type === 'error') {
        pending = false; clearTimeout(pendingTimer); updateControls();
        notice(message.message || 'That move could not be saved. Please try again.');
      }
    });
    ws.addEventListener('close',() => {
      if (ws !== socket) return;
      clearTimeout(connectionTimer); clearInterval(heartbeatTimer); clearTimeout(pendingTimer);
      pending = false; setConnection(false,0);
      if (!stopped) retryTimer = setTimeout(connect,Math.min(15000,1000 * 2 ** Math.min(retry++,4)) + Math.random()*500);
    });
    ws.addEventListener('error',() => ws.close());
  }

  el('name-form').addEventListener('submit',event => {
    event.preventDefault();
    playerName = el('player-name').value.trim().replace(/\s+/g,' ').slice(0,24);
    el('player-name').value = playerName; writeStored('privategames.name',playerName);
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type:'join',clientId,name:playerName}));
  });
  el('hint-toggle').addEventListener('click',() => sendAction('hint'));
  el('new-word').addEventListener('click',() => {
    if (!state || !live || pending) return;
    const skip = state.status === 'playing';
    if (skip && state.guesses.length && !confirm('Start a new word for everyone? This skips the current word.')) return;
    sendAction('next',{skip});
  });
  el('share-room').addEventListener('click',async () => {
    const url = new URL('/privategames',location.href).href;
    try {
      if (navigator.share) await navigator.share({title:'Play Hangman together',text:'Join our shared Hangman game.',url});
      else { await navigator.clipboard.writeText(url); notice('Room link copied. Send it to everyone who wants to play.'); }
    } catch (error) { if (error.name !== 'AbortError') notice('Share this link: ' + url); }
  });
  document.addEventListener('keydown',event => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || event.isComposing) return;
    if (event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); guess(event.key.toUpperCase()); }
  });
  document.addEventListener('visibilitychange',() => {
    if (document.hidden) return;
    if (socket?.readyState === WebSocket.OPEN && Date.now() - lastMessageAt > 60000) socket.close();
    else connect();
  });
  window.addEventListener('online',connect);
  window.addEventListener('offline',() => { setConnection(false,0); socket?.close(); });
  window.addEventListener('pagehide',() => {
    stopped = true; clearTimeout(retryTimer); clearInterval(heartbeatTimer); socket?.close(1000,'Leaving page');
  });
  window.addEventListener('pageshow',() => { stopped = false; connect(); });
  updateControls();
  fetch('/privategames/api/state',{cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error('No snapshot'); return r.json(); })
    .then(message => applySnapshot(message,false)).catch(() => {});
  connect();
})();
