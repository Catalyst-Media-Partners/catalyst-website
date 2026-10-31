import assert from 'node:assert/strict';
import worker from '../worker.mjs';
const page='<!doctype html><html lang="en"><head><meta name="robots" content="noindex,nofollow,noarchive"></head><body><main><h1>INFUSED</h1></main></body></html>';
const assets={async fetch(request){
 const u=new URL(request.url);
 if(u.pathname==='/sitemap.xml')return new Response('<?xml version="1.0"?><urlset><url><loc>https://infused.show/</loc></url></urlset>',{headers:{'Content-Type':'application/xml'}});
 return new Response(page,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','ETag':'synthetic'}});
}};
const call=(host,path='/',extra={})=>worker.fetch(new Request('https://'+host+path),{
 SITE_BASE_PATH:'/',SITE_MODE:'canary',SITE_ALLOWED_HOSTS:'dark.infused.show,infused.show,www.infused.show',ASSETS:assets,...extra
});
const canary=await call('dark.infused.show');
const canaryHtml=await canary.text();
assert.equal(canary.status,200);
assert.equal(canary.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
assert.ok(canaryHtml.includes('<meta name="robots" content="noindex, nofollow, noarchive">'));
assert.ok(canaryHtml.includes('<link rel="canonical" href="https://infused.show/">'));
assert.equal(canary.headers.get('x-dropjourney-version'),'2.9.2-native-intake');
const production=await call('infused.show','/',{SITE_MODE:'production'});
const productionHtml=await production.text();
assert.equal(production.status,200);
assert.equal(production.headers.get('x-robots-tag'),'index, follow');
assert.ok(productionHtml.includes('<meta name="robots" content="index, follow">'));
assert.ok(productionHtml.includes('<link rel="canonical" href="https://infused.show/">'));
const subpage=await call('infused.show','/market/',{SITE_MODE:'production'});
assert.ok((await subpage.text()).includes('https://infused.show/market/'));
const lightPage='<!doctype html><html lang="en"><head><meta name="robots" content="index, follow"><link rel="canonical" href="https://infused.show/"><link rel="stylesheet" href="./assets/site.css"></head><body><a href="./market/">Light page link</a><img src="./assets/light.webp"></body></html>';
let lightRequestUrl='';
let lightAssetRequestUrl='';
const lightSite={async fetch(request){
 const u=new URL(request.url);
 if(u.pathname.startsWith('/assets/')){lightAssetRequestUrl=request.url;return new Response('light asset',{status:200,headers:{'Content-Type':'image/webp'}});}
 lightRequestUrl=request.url;
 return new Response(lightPage,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','ETag':'light-synthetic'}});
}};
const lightLander=await call('infused.show','/lander/?utm_source=route-test',{SITE_MODE:'production',LIGHT_SITE:lightSite});
const lightLanderHtml=await lightLander.text();
assert.equal(lightLander.status,200);
assert.equal(lightRequestUrl,'https://infused.show/?utm_source=route-test','Light service must receive the existing homepage asset with query parameters');
assert.ok(lightLanderHtml.includes('<base href="/">'),'Light page navigation must resolve from the dark site root');
assert.ok(lightLanderHtml.includes('<link rel="stylesheet" href="/lander/assets/site.css">'),'Light page styles must remain isolated under /lander/assets');
assert.ok(lightLanderHtml.includes('<img src="/lander/assets/light.webp">'),'Light page images must remain isolated under /lander/assets');
assert.ok(lightLanderHtml.includes('<a href="./market/">Light page link</a>'),'Light page navigation must continue into the dark site');
assert.ok(lightLanderHtml.includes('<link rel="canonical" href="https://infused.show/lander/">'),'Light page canonical must be the single /lander path');
assert.ok(lightLanderHtml.includes('<meta name="robots" content="index, follow">'));
assert.equal(lightLander.headers.get('x-robots-tag'),'index, follow');
const lightAsset=await call('infused.show','/lander/assets/light.webp',{SITE_MODE:'production',LIGHT_SITE:lightSite});
assert.equal(lightAsset.status,200);
assert.equal(lightAssetRequestUrl,'https://infused.show/assets/light.webp','Light assets must be fetched from the original light Worker under the /lander/assets prefix');
const lightNoSlash=await call('infused.show','/lander?utm_source=route-test',{SITE_MODE:'production',LIGHT_SITE:lightSite});
assert.equal(lightNoSlash.status,308);
assert.equal(lightNoSlash.headers.get('location'),'https://infused.show/lander/?utm_source=route-test');
const darkAliasLander=await call('dark.infused.show','/lander/',{LIGHT_SITE:lightSite});
assert.equal(darkAliasLander.status,308,'Dark canary alias must not publish a second light-page URL');
assert.equal(darkAliasLander.headers.get('location'),'https://infused.show/lander/');
const noLightBinding=await call('infused.show','/lander/',{SITE_MODE:'production'});
assert.equal(noLightBinding.status,503,'Light route must fail closed if its Worker service binding is absent');
const www=await call('www.infused.show','/',{SITE_MODE:'production'});
assert.equal(www.status,308);
assert.equal(www.headers.get('location'),'https://infused.show/');
const unknown=await call('evil.example');
assert.equal(unknown.status,421);
const canaryRobots=await call('dark.infused.show','/robots.txt');
assert.ok((await canaryRobots.text()).includes('Disallow: /'));
const productionRobots=await call('infused.show','/robots.txt',{SITE_MODE:'production'});
assert.ok((await productionRobots.text()).includes('Allow: /'));
const canarySitemap=await call('dark.infused.show','/sitemap.xml');
assert.equal(canarySitemap.status,404);
const productionSitemap=await call('infused.show','/sitemap.xml',{SITE_MODE:'production'});
assert.equal(productionSitemap.status,200);
const legacy=await call('infused.show','/getting-started/',{SITE_MODE:'production'});
assert.equal(legacy.status,301);
assert.equal(legacy.headers.get('location'),'https://infused.show/');
let boothTarget='';
const booth=await worker.fetch(new Request('https://dark.infused.show/go/booth?position=hero&utm_campaign=inf1'),{
 SITE_BASE_PATH:'/',SITE_MODE:'canary',SITE_ALLOWED_HOSTS:'dark.infused.show',
 BOOTH_ATTRIBUTION:{async fetch(request){boothTarget=request.url;return Response.redirect('https://shows.map-dynamics.com/infusedlv2027/?register=',302);}}
});
assert.equal(booth.status,302);
assert.equal(new URL(boothTarget).hostname,'infused.show');
assert.equal(new URL(boothTarget).searchParams.get('utm_campaign'),'inf1');
const noBoothBinding=await call('infused.show','/go/booth',{SITE_MODE:'production'});
assert.equal(noBoothBinding.status,503);
const intakeUnavailable=await worker.fetch(new Request('https://dark.infused.show/api/intake',{method:'POST',headers:{Origin:'https://dark.infused.show','Content-Type':'application/json'},body:'{}'}),{
 SITE_BASE_PATH:'/',SITE_MODE:'canary',SITE_ALLOWED_HOSTS:'dark.infused.show',ASSETS:assets
});
assert.equal(intakeUnavailable.status,503,'Root intake route must resolve and fail closed when not provisioned');
const ticketStatus=await call('dark.infused.show','/tickets/api/status',{TICKET_NOTIFY_ENABLED:'false'});
assert.deepEqual(await ticketStatus.json(),{enabled:false});
const preview=await worker.fetch(new Request('https://infused.show/dropjourneytest/'),{
 SITE_BASE_PATH:'/dropjourneytest/',SITE_MODE:'preview',SITE_ALLOWED_HOSTS:'infused.show',ASSETS:assets
});
assert.equal(preview.status,200);
assert.equal(preview.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
const previewIntake=await worker.fetch(new Request('https://infused.show/dropjourneytest/api/intake',{method:'POST',headers:{Origin:'https://infused.show','Content-Type':'application/json'},body:'{}'}),{
 SITE_BASE_PATH:'/dropjourneytest/',SITE_MODE:'preview',SITE_ALLOWED_HOSTS:'infused.show',ASSETS:assets
});
assert.equal(previewIntake.status,503);
console.log('PASS INFUSED dark Worker: root/canary host policy, robots/canonical, legacy redirects, same-origin intake path, disabled ticket notices and booth attribution service binding');
