const ROOM_NAME = 'catalyst-hangman-v1';
const API_PATHS = new Set(['/privategames/api/state', '/privategames/api/socket']);

function errorResponse(status, message) {
  return Response.json({error:message},{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'}});
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/privategames' && !url.pathname.startsWith('/privategames/')) {
      return env.ASSETS.fetch(request);
    }
    if (url.pathname.startsWith('/privategames/api/')) {
      if (!API_PATHS.has(url.pathname)) return errorResponse(404,'Unknown game endpoint.');
      if (request.method !== 'GET') return errorResponse(405,'Use GET for the game connection.');
      const origin = request.headers.get('Origin');
      if (origin && origin !== url.origin) return errorResponse(403,'Use this website to join the game.');
      if (url.pathname.endsWith('/socket')) {
        if (origin !== url.origin) return errorResponse(403,'A same-origin game connection is required.');
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return errorResponse(426,'A WebSocket connection is required.');
      }
      try {
        const room = env.HANGMAN_ROOMS.get(env.HANGMAN_ROOMS.idFromName(ROOM_NAME));
        return await room.fetch(request);
      } catch (error) {
        console.error('Private game room request failed:',error?.message || 'unknown error');
        return errorResponse(503,'The shared game is temporarily unavailable. Please reconnect.');
      }
    }
    let assetRequest = request;
    if (url.pathname === '/privategames' || url.pathname === '/privategames/') {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = '/privategames/';
      assetRequest = new Request(assetUrl,request);
    }
    const response = await env.ASSETS.fetch(assetRequest);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control','no-cache, must-revalidate');
    headers.set('X-Robots-Tag','noindex, nofollow');
    headers.set('X-Content-Type-Options','nosniff');
    headers.set('Referrer-Policy','same-origin');
    const socketOrigin = (url.protocol === 'https:' ? 'wss://' : 'ws://') + url.host;
    headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; worker-src 'self'; manifest-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' " + socketOrigin + "; img-src 'self' data:; base-uri 'none'; frame-ancestors 'self'");
    if (url.pathname === '/privategames/sw.js') {
      headers.set('Service-Worker-Allowed','/privategames/');
      headers.set('Cache-Control','no-store');
    }
    if (url.pathname === '/privategames/manifest.webmanifest') headers.set('Content-Type','application/manifest+json; charset=utf-8');
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
};
