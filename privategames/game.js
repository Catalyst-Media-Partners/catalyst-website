import { createTurnNotifications } from './notifications.js?v=3';

(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const keys = new Map();
  const parts = [...document.querySelectorAll('.drawing-part')];
  let state = null, socket = null, live = false, pending = false, connectedPlayers = [], catalog = null;
  let settingsRound = null, pushConnected = false, serverOffset = 0, seenPassAt = null;
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
  let ownerSecret = readStored('privategames.pushOwnerSecret');
  if (!ownerSecret || !/^[A-Za-z0-9_-]{43}$/.test(ownerSecret)) {
    ownerSecret = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    writeStored('privategames.pushOwnerSecret',ownerSecret);
  }
  let leftRoom = readStored('privategames.leftRoom') === '1';
  stopped = leftRoom;
  el('player-name').value = playerName;

  const notifications = createTurnNotifications({
    send: message => {
      if (!live || leftRoom || socket?.readyState !== WebSocket.OPEN) throw new Error('Join the live game first.');
      socket.send(JSON.stringify(message));
    },
    notice,
  });
  for (let length=3;length<=15;length++) for (const id of ['min-length','max-length']) {
    const option = document.createElement('option'); option.value = length; option.textContent = length + ' letters'; el(id).appendChild(option);
  }
  el('min-length').value = '3'; el('max-length').value = '15';

  function selectedSettings() {
    const [mode,seconds] = el('turn-rule').value.split(':');
    return {vocabulary:el('vocabulary').value,minLength:Number(el('min-length').value),maxLength:Number(el('max-length').value),turnMode:mode,turnSeconds:mode === 'timer' ? Number(seconds) : 90};
  }

  function selectedWordCount() {
    if (!catalog?.levels) return null;
    const selected = selectedSettings();
    const level = catalog.levels.find(item => item.id === selected.vocabulary);
    if (!level || selected.minLength > selected.maxLength) return 0;
    let count = 0;
    for (let n=selected.minLength;n<=selected.maxLength;n++) count += Number(level.countsByLength?.[n] || 0);
    return count;
  }

  function renderSettings() {
    const current = state?.settings || {vocabulary:'middle',minLength:3,maxLength:15,turnMode:'vote',turnSeconds:90};
    if (state && settingsRound !== state.roundId) {
      el('vocabulary').value = current.vocabulary;
      el('min-length').value = current.minLength;
      el('max-length').value = current.maxLength;
      el('turn-rule').value = current.turnMode === 'timer' ? 'timer:' + current.turnSeconds : 'vote';
      settingsRound = state.roundId;
    }
    const labels = {easy:'Easy',middle:'Middle school',advanced:'Advanced',dictionary:'Full dictionary'};
    const selected = selectedSettings();
    const lengthLabel = selected.minLength === selected.maxLength ? selected.minLength + ' letters' : selected.minLength + '–' + selected.maxLength + ' letters';
    el('settings-summary').textContent = labels[selected.vocabulary] + ' · ' + lengthLabel;
    el('level-label').textContent = 'Shared room · ' + labels[current.vocabulary];
    const count = selectedWordCount();
    el('pool-count').textContent = count === null ? 'Loading dictionary…' : count === 0 ? 'No words match. Choose another length or vocabulary level.' : count.toLocaleString() + ' matching words. ' + (myTurn() ? 'Your choices apply when you start the next word.' : 'The current player can apply settings to the next word.');
    if (catalog?.total) el('dictionary-footer').textContent = catalog.total.toLocaleString() + ' dictionary words · 10 strikes';
  }

  function renderClock() {
    const turn = state?.turn;
    const seconds = turn?.deadlineAt ? Math.max(0,Math.ceil((turn.deadlineAt - Date.now() - serverOffset)/1000)) : null;
    el('turn-clock').textContent = leftRoom ? 'You left the game' : !live ? 'Reconnecting…' : turn?.paused ? 'Turn clock paused' : seconds !== null ? seconds > 0 ? seconds + 's to play' : 'Updating turn…' : 'Group vote · no rush';
    el('turn-clock').classList.toggle('urgent',live && seconds !== null && seconds <= 15);
  }

  function notice(message) {
    clearTimeout(noticeTimer);
    el('notice').textContent = message;
    el('notice').hidden = !message;
    if (message) noticeTimer = setTimeout(() => { el('notice').hidden = true; }, 9000);
  }

  const myTurn = () => !!state?.turn?.activePlayerId && state.turn.activePlayerId === clientId;
  const inRoster = () => !!state?.turn?.order?.some(player => player.id === clientId);
  const waitingIndex = () => state?.turn?.waiting?.findIndex(player => player.id === clientId) ?? -1;

  function renderTurns() {
    const turn = state?.turn;
    const active = turn?.order?.find(player => player.id === turn.activePlayerId);
    const mine = myTurn();
    const queued = waitingIndex();
    const reconnecting = !!active && active.connected === false;
    el('turn-notice').classList.toggle('is-mine',mine && live && !reconnecting);
    el('turn-notice').classList.toggle('is-waiting',queued >= 0);
    el('turn-cycle').textContent = turn ? 'PLAYER CYCLE ' + turn.cycle : 'PLAYER CYCLE';
    el('turn-label').textContent = leftRoom ? 'YOU LEFT THE GAME' : !live ? 'CONNECTING' : reconnecting ? 'WAITING FOR PLAYER' : mine ? 'YOUR TURN' : state?.status !== 'playing' ? 'NEXT WORD' : 'CURRENT TURN';
    el('turn-player').textContent = turn?.activePlayerName || 'Waiting for players';
    el('turn-detail').textContent = leftRoom ? 'Tap Rejoin game when you are ready.' : !live ? 'Reconnecting to the saved game.'
      : queued >= 0 ? 'You join after this player cycle.'
      : reconnecting ? active.pushEnabled ? 'Turn alert enabled. Waiting for this player.' : 'Waiting briefly for this player to reconnect.'
      : mine ? state.status === 'playing' ? 'Choose one letter.' : 'Start the next word for everyone.'
      : turn?.activePlayerId ? 'One letter, then the next player.' : 'Join the game to begin.';
    if (live) el('room-note').textContent = queued >= 0
      ? 'You are queued for the next player cycle (waiting position ' + (queued + 1) + ').'
      : mine ? state.status === 'playing' ? 'Your turn. Choose one letter; correct and incorrect guesses both pass the turn.' : 'Your turn. Start the next word for everyone.'
      : turn?.activePlayerName ? turn.activePlayerName + ' has the turn. Players go in entry order.'
      : 'Joining the turn order…';
    el('players').replaceChildren();
    const ordered = turn ? [
      ...turn.order.map((player,index) => ({...player,position:index+1,waiting:false})),
      ...turn.waiting.map(player => ({...player,waiting:true}))
    ] : connectedPlayers;
    for (const player of ordered.slice(0,16)) {
      const chip = document.createElement('span');
      chip.className = 'player-chip' + (player.id === turn?.activePlayerId ? ' current' : '') + (player.waiting ? ' waiting' : '') + (player.connected === false ? ' disconnected' : '');
      chip.textContent = (player.position ? player.position + '. ' : '') + (player.name || 'Guest') + (player.id === clientId ? ' (you)' : '') + (player.waiting ? ' · next cycle' : player.connected === false ? player.pushEnabled ? ' · away' : ' · reconnecting' : '');
      if (player.id === turn?.activePlayerId) chip.setAttribute('aria-current','true');
      el('players').appendChild(chip);
    }
    if (ordered.length > 16) {
      const more = document.createElement('span'); more.textContent = '+' + (ordered.length - 16) + ' more';
      el('players').appendChild(more);
    }
    const vote = turn?.vote;
    const voters = vote?.voterIds || [];
    const eligible = vote?.eligibleIds || [];
    el('pass-turn').hidden = !mine || leftRoom;
    el('vote-skip').hidden = mine || leftRoom || state?.settings?.turnMode === 'timer';
    el('vote-skip').textContent = voters.includes(clientId) ? 'Vote recorded · ' + voters.length + '/' + vote.required : 'Vote to skip ' + (turn?.activePlayerName || 'player');
    el('vote-status').textContent = leftRoom ? 'Your saved game remains available. Rejoining follows the normal turn order.' : queued >= 0 ? 'You can vote after joining the active player cycle.' : state?.settings?.turnMode === 'timer' ? 'The server passes the turn when time runs out. Passing costs no strike.' : eligible.length < 2 ? 'A vote needs at least two other players. Small groups use a 90-second turn timer.' : voters.length + ' of ' + (vote?.required || 2) + ' votes to pass this turn. At least two votes and a majority are required.';
    el('rejoin-room').hidden = !leftRoom;
    el('leave-room').hidden = leftRoom;
    const lastPass = turn?.lastPass;
    if (lastPass && lastPass.at !== seenPassAt) {
      if (seenPassAt !== null) notice(lastPass.name + (lastPass.reason === 'vote' ? ' was skipped by the group vote.' : lastPass.reason === 'voluntary' ? ' passed their turn.' : ' ran out of time. The turn has passed.'));
      seenPassAt = lastPass.at;
    } else if (seenPassAt === null) seenPassAt = 0;
    renderClock();
    notifications.setTurn({mine,turnToken:turn?.token});
  }

  function setConnection(connected, count) {
    live = connected;
    el('connection').className = 'connection ' + (connected ? 'live' : state ? 'offline' : '');
    el('connection-label').textContent = leftRoom ? 'You left the game' : connected
      ? 'Live · ' + count + (count === 1 ? ' player' : ' players')
      : navigator.onLine ? 'Connecting…' : 'Offline · moves paused';
    el('room-note').textContent = leftRoom ? 'Tap Rejoin game to return to the shared room.' : connected
      ? 'Everyone at this link shares the same word, guesses, and score.'
      : state ? 'Reconnecting to the saved game. Your board will update automatically.'
      : 'Connecting to the shared game. Your moves are saved after every guess.';
    renderTurns();
    updateControls();
  }

  function updateControls() {
    const available = live && socket?.readyState === WebSocket.OPEN && state && !pending;
    const guessed = new Map((state?.guesses || []).map(g => [g.letter, g]));
    for (const [letter, button] of keys) {
      const guess = guessed.get(letter);
      button.disabled = !available || !myTurn() || state.status !== 'playing' || guessed.has(letter);
      button.classList.toggle('correct', !!guess?.correct);
      button.classList.toggle('wrong', !!guess && !guess.correct);
      button.setAttribute('aria-label', letter + (guess ? guess.correct ? ', correct guess' : ', incorrect guess' : ', guess letter'));
    }
    el('hint-toggle').disabled = !available || !inRoster() || state?.status !== 'playing';
    el('new-word').disabled = !available || !myTurn() || selectedWordCount() === 0;
    el('pass-turn').disabled = !available || !myTurn();
    const vote = state?.turn?.vote;
    el('vote-skip').disabled = !available || !inRoster() || myTurn() || !vote?.eligibleIds?.includes(clientId) || vote.eligibleIds.length < 2 || vote.voterIds.includes(clientId);
    el('leave-room').disabled = !available;
    el('settings-fields').disabled = !available || !myTurn();
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
    renderSettings();
    renderTurns();
    updateControls();
  }

  function applySnapshot(envelope, fromSocket) {
    if (envelope?.type !== 'state' || !envelope.state) return;
    const next = envelope.state;
    if (!Array.isArray(next.mask) || !Array.isArray(next.guesses) || next.length < 1 || next.length > 15) return;
    if (fromSocket) {
      pending = false; clearTimeout(pendingTimer);
      connectedPlayers = Array.isArray(envelope.players) ? envelope.players : [];
      retry = 0;
      setConnection(true,connectedPlayers.length);
    }
    if (Number.isFinite(envelope.serverTime)) serverOffset = envelope.serverTime - Date.now();
    if (envelope.catalog) catalog = envelope.catalog;
    if (!state || next.revision >= state.revision) {
      state = next; renderState();
    } else updateControls();
    if (fromSocket && !pushConnected && !leftRoom && connectedPlayers.some(player => player.id === clientId)) {
      pushConnected = true; notifications.connected();
    }
  }

  function sendAction(type, fields = {}) {
    if (!live || !state || pending || socket?.readyState !== WebSocket.OPEN) return;
    if ((type === 'guess' || type === 'next' || type === 'pass') && !myTurn()) return;
    if (type === 'hint' && !inRoster()) return;
    pending = true; updateControls();
    try { socket.send(JSON.stringify({type,roundId:state.roundId,turnToken:state.turn?.token,...fields})); }
    catch { pending = false; socket.close(); return; }
    clearTimeout(pendingTimer);
    pendingTimer = setTimeout(() => {
      pending = false;
      notice('Connection interrupted. Reconnecting to check the saved game…');
      socket?.close();
    },8000);
  }

  function guess(letter) {
    if (!state || !myTurn() || state.status !== 'playing' || !/^[A-Z]$/.test(letter) || state.guesses.some(g => g.letter === letter)) return;
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
      clearTimeout(connectionTimer); lastMessageAt = Date.now();
      ws.send(JSON.stringify({type:'join',clientId,name:playerName,ownerSecret,protocol:3}));
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
      if (notifications.message(message)) return;
      if (message.type === 'left') {
        leftRoom = true; stopped = true; writeStored('privategames.leftRoom','1');
        pending = false; pushConnected = false; clearTimeout(pendingTimer); notifications.disconnected();
        setConnection(false,0); ws.close(1000,'Left game'); return;
      }
      if (message.type === 'state') applySnapshot(message,true);
      if (message.type === 'error') {
        pending = false; clearTimeout(pendingTimer); updateControls();
        notice(message.message || 'That move could not be saved. Please try again.');
      }
    });
    ws.addEventListener('close',() => {
      if (ws !== socket) return;
      clearTimeout(connectionTimer); clearInterval(heartbeatTimer); clearTimeout(pendingTimer);
      pending = false; pushConnected = false; notifications.disconnected(); setConnection(false,0);
      if (!stopped) retryTimer = setTimeout(connect,Math.min(15000,1000 * 2 ** Math.min(retry++,4)) + Math.random()*500);
    });
    ws.addEventListener('error',() => ws.close());
  }

  el('name-form').addEventListener('submit',event => {
    event.preventDefault();
    playerName = el('player-name').value.trim().replace(/\s+/g,' ').slice(0,24);
    el('player-name').value = playerName; writeStored('privategames.name',playerName);
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({type:'join',clientId,name:playerName,ownerSecret,protocol:3}));
  });
  el('hint-toggle').addEventListener('click',() => sendAction('hint'));
  el('new-word').addEventListener('click',() => {
    if (!state || !live || !myTurn() || pending) return;
    const skip = state.status === 'playing';
    if (skip && state.guesses.length && !confirm('Start a new word for everyone? This skips the current word.')) return;
    if (selectedWordCount() === 0) { notice('Choose a word length and vocabulary level with matching words.'); return; }
    sendAction('next',{skip,settings:selectedSettings()});
  });
  el('pass-turn').addEventListener('click',() => sendAction('pass'));
  el('vote-skip').addEventListener('click',() => { if (!el('vote-skip').disabled) sendAction('voteSkip'); });
  el('leave-room').addEventListener('click',() => {
    if (confirm('Leave this game? You will stop receiving turn alerts until you rejoin.')) sendAction('leave');
  });
  el('rejoin-room').addEventListener('click',() => {
    leftRoom = false; stopped = false; writeStored('privategames.leftRoom','0'); connect();
  });
  for (const id of ['vocabulary','min-length','max-length','turn-rule']) el(id).addEventListener('change',() => {
    if (Number(el('min-length').value) > Number(el('max-length').value)) {
      if (id === 'min-length') el('max-length').value = el('min-length').value;
      else el('min-length').value = el('max-length').value;
    }
    renderSettings(); updateControls();
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
  window.addEventListener('pageshow',() => { stopped = leftRoom; connect(); });
  setInterval(renderClock,500);
  renderSettings();
  renderTurns();
  updateControls();
  fetch('/privategames/api/state',{cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error('No snapshot'); return r.json(); })
    .then(message => applySnapshot(message,false)).catch(() => {});
  connect();
})();
