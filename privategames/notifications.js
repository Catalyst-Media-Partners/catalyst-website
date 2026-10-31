const secretSafeError = error => error?.message || 'Phone alerts could not be updated. Please try again.';

export function decodeApplicationKey(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{87}$/.test(value)) throw new Error('The notification key is unavailable. Reconnect and try again.');
  const raw = atob(value.replace(/-/g,'+').replace(/_/g,'/') + '=');
  const bytes = Uint8Array.from(raw,char => char.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error('The notification key is invalid.');
  return bytes;
}

export function createTurnNotifications({send,notice}) {
  const el = id => document.getElementById(id);
  const pending = new Map();
  let online = false, busy = false, enabled = false, publicKey = null, registration = null, registrationPromise = null;
  let epoch = 0, lastTurn = null, reason = '', refreshRequired = false;
  try { refreshRequired = localStorage.getItem('privategames.pushRefreshNeeded') === '1'; } catch {}
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const supported = () => window.isSecureContext && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const permission = () => 'Notification' in window ? Notification.permission : 'unsupported';
  const readWanted = () => { try { return localStorage.getItem('privategames.pushWanted') === '1'; } catch { return false; } };
  const writeWanted = value => { try { localStorage.setItem('privategames.pushWanted',value ? '1' : '0'); } catch {} };
  const requireRefresh = value => { refreshRequired = value; try { localStorage.setItem('privategames.pushRefreshNeeded',value ? '1' : '0'); } catch {} };

  function render() {
    const needsInstall = ios && !standalone();
    el('install-help').hidden = !needsInstall;
    el('push-enable').hidden = enabled && !needsInstall;
    el('push-test').hidden = !enabled || needsInstall;
    el('push-disable').hidden = !enabled;
    el('push-enable').textContent = needsInstall ? 'Set up iPhone alerts' : busy ? 'Setting up alerts…' : !supported() ? 'Alerts unavailable here' : permission() === 'denied' ? 'Alerts blocked in settings' : 'Enable turn alerts';
    el('push-enable').disabled = busy || (!needsInstall && (!online || !supported() || permission() === 'denied' || !publicKey));
    el('push-test').disabled = busy || !online || !enabled;
    el('push-disable').disabled = busy || !online;
    el('push-status').textContent = reason || (needsInstall ? 'iPhone alerts require opening Hangman from your Home Screen.' : !supported() ? 'This browser does not support phone alerts. You can still play here.' : permission() === 'denied' ? 'Notifications are blocked. Allow Hangman notifications in your device or browser settings.' : enabled ? online ? 'Turn alerts are on for this device. You can switch apps while waiting.' : 'Turn alerts are on. Rejoin the game to take part.' : 'Optional phone alerts when it is your turn. Permission is requested only when you enable them.');
  }

  function request(type,fields = {}) {
    return new Promise((resolve,reject) => {
      const requestId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID()
        : btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('The server did not respond. Reconnect and try again.')); },12000);
      pending.set(requestId,{resolve,reject,timer});
      try { send({type,requestId,...fields}); }
      catch (error) { clearTimeout(timer); pending.delete(requestId); reject(error); }
    });
  }

  function getRegistration() {
    if (registration?.active) return Promise.resolve(registration);
    if (registrationPromise) return registrationPromise;
    registrationPromise = (async () => {
      if (!supported()) throw new Error('Phone alerts are not supported in this browser.');
      const reg = await navigator.serviceWorker.register('/privategames/sw.js?v=3',{scope:'/privategames/',updateViaCache:'none'});
      // The short /privategames URL is outside the trailing-slash scope. Wait
      // on this registration, not navigator.serviceWorker.ready for the page.
      if (!reg.active) await new Promise((resolve,reject) => {
        const worker = reg.installing || reg.waiting;
        if (!worker) { reject(new Error('Notification setup did not start. Refresh and try again.')); return; }
        const timer = setTimeout(() => { worker.removeEventListener('statechange',changed); reject(new Error('Notification setup took too long. Try again.')); },12000);
        const changed = () => {
          if (worker.state === 'activated') { clearTimeout(timer); worker.removeEventListener('statechange',changed); resolve(); }
          if (worker.state === 'redundant') { clearTimeout(timer); worker.removeEventListener('statechange',changed); reject(new Error('Notification setup needs a refresh.')); }
        };
        worker.addEventListener('statechange',changed); changed();
      });
      registration = reg;
      return reg;
    })().catch(error => { registrationPromise = null; throw error; });
    return registrationPromise;
  }

  async function enable() {
    if (ios && !standalone()) {
      el('install-help').open = true;
      el('install-help').scrollIntoView({block:'nearest',behavior:'smooth'});
      return;
    }
    if (!online || busy || !publicKey || !supported()) return;
    // Invoke permission directly from the click, before awaiting registration.
    const permissionRequest = permission() === 'default' ? Notification.requestPermission() : Promise.resolve(permission());
    busy = true; reason = ''; render();
    try {
      if (await permissionRequest !== 'granted') throw new Error('Permission was not granted. You can keep playing without phone alerts.');
      const reg = await getRegistration();
      let subscription = await reg.pushManager.getSubscription();
      if (subscription && refreshRequired) { await subscription.unsubscribe(); subscription = null; }
      if (subscription?.options?.applicationServerKey) {
        const expected = decodeApplicationKey(publicKey);
        const existing = new Uint8Array(subscription.options.applicationServerKey);
        if (existing.length !== expected.length || existing.some((value,index) => value !== expected[index])) {
          await subscription.unsubscribe(); subscription = null;
        }
      }
      if (!subscription) subscription = await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeApplicationKey(publicKey)});
      await request('pushSubscribe',{subscription:subscription.toJSON()});
      writeWanted(true); requireRefresh(false); enabled = true;
      reason = 'Turn alerts are on. Tap Test alert to check delivery on this device.';
      notice('Turn alerts enabled for this device.');
    } catch (error) { reason = secretSafeError(error); notice(reason); }
    finally { busy = false; render(); }
  }

  el('push-enable').addEventListener('click',enable);
  el('push-test').addEventListener('click',async () => {
    if (!online || busy || !enabled) return;
    busy = true; reason = ''; render();
    try { await request('pushTest'); reason = 'Test alert requested. Check your notifications; Focus or Do Not Disturb may silence the banner.'; }
    catch (error) { reason = secretSafeError(error); }
    finally { busy = false; render(); }
  });
  el('push-disable').addEventListener('click',async () => {
    if (!online || busy) return;
    busy = true; reason = ''; render();
    try {
      await request('pushUnsubscribe');
      writeWanted(false); requireRefresh(false); enabled = false;
      try { const reg = await getRegistration(); const subscription = await reg.pushManager.getSubscription(); await subscription?.unsubscribe(); } catch {}
      reason = 'Turn alerts are off for this device.';
    } catch (error) { reason = secretSafeError(error); }
    finally { busy = false; render(); }
  });

  // Registration does not request notification permission or subscribe anyone.
  if (supported() && (!ios || standalone())) getRegistration().catch(() => {});
  render();
  return {
    async connected() {
      online = true; const currentEpoch = ++epoch; reason = ''; render();
      try {
        const result = await request('pushStatus');
        if (currentEpoch !== epoch) return;
        publicKey = result.publicKey || null; enabled = result.enabled === true;
        if (permission() === 'denied' && enabled) {
          await request('pushUnsubscribe'); enabled = false; writeWanted(false);
        } else if (!refreshRequired && supported() && permission() === 'granted' && readWanted() && (!ios || standalone())) {
          const reg = await getRegistration(); const subscription = await reg.pushManager.getSubscription();
          if (subscription && !enabled) { await request('pushSubscribe',{subscription:subscription.toJSON()}); enabled = true; }
          else if (!subscription && enabled) { await request('pushUnsubscribe'); enabled = false; }
        }
      } catch (error) { if (currentEpoch === epoch) reason = secretSafeError(error); }
      finally { if (currentEpoch === epoch) render(); }
    },
    disconnected() {
      online = false; epoch++;
      for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('The connection changed. Rejoin the game and try again.')); }
      pending.clear(); busy = false; reason = ''; render();
    },
    message(message) {
      if (message?.type !== 'push') return false;
      const item = pending.get(message.requestId);
      if (message.publicKey) publicKey = message.publicKey;
      if (typeof message.enabled === 'boolean') enabled = message.enabled;
      if (message.status === 'expired') {
        requireRefresh(true);
        reason = 'This device’s notification subscription has expired. Enable turn alerts again to reconnect it.';
      }
      if (!item) {
        if (message.error) reason = typeof message.error === 'string' ? message.error : message.error.message || 'Notifications could not be updated.';
        else if (message.status === 'sent') reason = 'The notification service accepted the alert. Your device settings control its display.';
        render(); return true;
      }
      clearTimeout(item.timer); pending.delete(message.requestId);
      if (message.error) item.reject(new Error(typeof message.error === 'string' ? message.error : message.error.message || 'Phone alerts could not be updated.'));
      else {
        item.resolve(message);
      }
      render(); return true;
    },
    setTurn({mine,turnToken}) {
      if (!turnToken || lastTurn === turnToken) return;
      lastTurn = turnToken;
      if (!mine && registration?.active) registration.active.postMessage({type:'clear-turn-alerts'});
    },
  };
}
