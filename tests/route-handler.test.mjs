import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/route-handler.mjs';

function fixture() {
  const calls = [];
  const env = {
    ASSETS: {fetch:async request => { calls.push(['asset',new URL(request.url).pathname]); return new Response('static page',{headers:{'Content-Type':'text/html'}}); }},
    HANGMAN_ROOMS: {
      idFromName(name) { calls.push(['room',name]); return name; },
      get() { return {fetch:async request => { calls.push(['backend',new URL(request.url).pathname]); return Response.json({type:'state',state:{revision:1}},{headers:{'Cache-Control':'no-store'}}); }}; }
    }
  };
  return {env,calls};
}

test('existing website and nearby paths keep asset fallback without opening game state', async () => {
  for (const path of ['/','/assets/favicon.png','/privategames-old']) {
    const {env,calls}=fixture();
    const response=await worker.fetch(new Request('https://catalystmediapartners.com'+path),env);
    assert.equal(await response.text(),'static page');
    assert.deepEqual(calls,[['asset',path]]);
    assert.equal(response.headers.get('X-Robots-Tag'),null);
  }
});

test('both game entry URLs serve the index through the asset directory',async () => {
  for (const path of ['/privategames','/privategames/']) {
    const {env,calls}=fixture();
    const response=await worker.fetch(new Request('https://catalystmediapartners.com'+path),env);
    assert.equal(response.status,200);
    assert.deepEqual(calls,[['asset','/privategames/']]);
    assert.match(response.headers.get('X-Robots-Tag'),/noindex/);
    assert.match(response.headers.get('Content-Security-Policy'),/wss:\/\/catalystmediapartners.com/);
  }
});

test('apex and www use the same durable room identity',async () => {
  for (const host of ['catalystmediapartners.com','www.catalystmediapartners.com']) {
    const {env,calls}=fixture();
    const response=await worker.fetch(new Request('https://'+host+'/privategames/api/state'),env);
    assert.equal(response.status,200);
    assert.deepEqual(calls,[['room','catalyst-hangman-v1'],['backend','/privategames/api/state']]);
  }
});

test('cross-origin sockets and unsupported mutations never reach the room',async () => {
  const badRequests=[
    [new Request('https://catalystmediapartners.com/privategames/api/socket',{headers:{Origin:'https://another.example',Upgrade:'websocket'}}),403],
    [new Request('https://catalystmediapartners.com/privategames/api/socket',{headers:{Upgrade:'websocket'}}),403],
    [new Request('https://catalystmediapartners.com/privategames/api/socket',{headers:{Origin:'https://catalystmediapartners.com'}}),426],
    [new Request('https://catalystmediapartners.com/privategames/api/state',{method:'POST'}),405],
    [new Request('https://catalystmediapartners.com/privategames/api/reset'),404]
  ];
  for (const [request,status] of badRequests) {
    const {env,calls}=fixture();
    assert.equal((await worker.fetch(request,env)).status,status);
    assert.deepEqual(calls,[]);
  }
});

test('same-origin WebSocket request is passed unchanged to the durable room',async () => {
  const {env,calls}=fixture();
  const request=new Request('https://catalystmediapartners.com/privategames/api/socket',{headers:{Origin:'https://catalystmediapartners.com',Upgrade:'websocket'}});
  await worker.fetch(request,env);
  assert.deepEqual(calls,[['room','catalyst-hangman-v1'],['backend','/privategames/api/socket']]);
});

test('notification service worker is restricted to the game path and never cached',async () => {
  const {env,calls}=fixture();
  const response=await worker.fetch(new Request('https://catalystmediapartners.com/privategames/sw.js?v=3'),env);
  assert.equal(response.headers.get('Service-Worker-Allowed'),'/privategames/');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.match(response.headers.get('Content-Security-Policy'),/worker-src 'self'/);
  assert.deepEqual(calls,[['asset','/privategames/sw.js']]);
});

test('installable manifest is served with the expected type without opening game state',async () => {
  const {env,calls}=fixture();
  const response=await worker.fetch(new Request('https://catalystmediapartners.com/privategames/manifest.webmanifest'),env);
  assert.equal(response.headers.get('Content-Type'),'application/manifest+json; charset=utf-8');
  assert.deepEqual(calls,[['asset','/privategames/manifest.webmanifest']]);
});
