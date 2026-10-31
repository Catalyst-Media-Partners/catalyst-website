const GAME_PATH = '/privategames/';
const TURN_TAG = 'hangman-turn';

self.addEventListener('install',event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event => event.waitUntil(self.clients.claim()));

// No fetch handler or offline game cache: every move uses the shared server.
self.addEventListener('push',event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch {}
  const isTest = payload.kind === 'test';
  const stale = !isTest && Number.isFinite(payload.expiresAt) && payload.expiresAt < Date.now();
  const title = stale ? 'Hangman — game update' : String(payload.title || (isTest ? 'Hangman — test alert' : 'Hangman — your turn')).slice(0,90);
  const body = stale ? 'The turn may have moved on. Tap to see the current game.' : String(payload.body || 'Tap to return to the shared game.').slice(0,200);
  event.waitUntil(self.registration.showNotification(title,{
    body,
    icon:'/privategames/icon-192.png',
    badge:'/privategames/badge.png',
    tag:isTest ? 'hangman-test' : TURN_TAG,
    renotify:true,
    timestamp:Date.now(),
    data:{url:GAME_PATH,turnToken:payload.turnToken || null,kind:isTest ? 'test' : 'turn'},
  }));
});

self.addEventListener('notificationclick',event => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin && (url.pathname === '/privategames' || url.pathname === GAME_PATH)) {
        await client.focus(); return;
      }
    }
    await self.clients.openWindow(GAME_PATH);
  })());
});

self.addEventListener('message',event => {
  if (event.data?.type !== 'clear-turn-alerts') return;
  event.waitUntil((async () => {
    const source = event.source;
    if (!source?.url) return;
    const url = new URL(source.url);
    if (url.origin !== self.location.origin || !['/privategames',GAME_PATH].includes(url.pathname)) return;
    const alerts = await self.registration.getNotifications({tag:TURN_TAG});
    for (const alert of alerts) alert.close();
  })());
});
