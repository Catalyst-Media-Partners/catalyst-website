import assert from 'node:assert/strict';
import worker from '../worker.mjs';

const darkPage='<!doctype html><html lang="en"><head><meta name="robots" content="noindex, nofollow, noarchive"></head><body><main><h1>INFUSED DARK</h1></main></body></html>';
const lightPage='<!doctype html><html lang="en"><head><meta name="robots" content="noindex, nofollow, noarchive"><base href="/"><link rel="stylesheet" href="/assets/css/site.css"><script src="/assets/js/cta-attribution.js" defer></script></head><body><main><h1>INFUSED LIGHT LANDER</h1><a href="/market/">Light page link</a><img src="/assets/images/light.webp" alt="Light asset"></main></body></html>';
const assetRequests=[];
const assets={async fetch(request){
 const u=new URL(request.url);assetRequests.push(u.pathname);
 if(u.pathname==='/sitemap.xml')return new Response('<?xml version="1.0"?><urlset><url><loc>https://infused.show/</loc></url></urlset>',{headers:{'Content-Type':'application/xml'}});
 if(u.pathname.endsWith('/lander/'))return new Response(lightPage,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','ETag':'light-synthetic'}});
 if(u.pathname.endsWith('/assets/css/site.css'))return new Response('body{color:#201929}',{status:200,headers:{'Content-Type':'text/css; charset=utf-8'}});
 if(u.pathname.endsWith('/assets/js/cta-attribution.js'))return new Response('/* first-party CTA */',{status:200,headers:{'Content-Type':'text/javascript; charset=utf-8'}});
 if(u.pathname.endsWith('/assets/images/light.webp'))return new Response('image',{status:200,headers:{'Content-Type':'image/webp'}});
 return new Response(darkPage,{status:200,headers:{'Content-Type':'text/html; charset=utf-8','ETag':'dark-synthetic'}});
}};
const allowed='infused.show,www.infused.show,dark.infused.show,light.infused.show';
const call=(host,path='/',extra={})=>worker.fetch(new Request('https://'+host+path),{
 SITE_BASE_PATH:'/',SITE_MODE:'canary',SITE_ALLOWED_HOSTS:allowed,ASSETS:assets,...extra
});

const canary=await call('dark.infused.show');
const canaryHtml=await canary.text();
assert.equal(canary.status,200);
assert.equal(canary.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
assert.ok(canaryHtml.includes('<meta name="robots" content="noindex, nofollow, noarchive">'));
assert.ok(canaryHtml.includes('<link rel="canonical" href="https://infused.show/">'));
assert.equal(canary.headers.get('x-dropjourney-version'),'2.9.3-single-worker');

const production=await call('infused.show','/',{SITE_MODE:'production'});
const productionHtml=await production.text();
assert.equal(production.status,200);
assert.equal(production.headers.get('x-robots-tag'),'index, follow');
assert.ok(productionHtml.includes('<meta name="robots" content="index, follow">'));
assert.ok(productionHtml.includes('<link rel="canonical" href="https://infused.show/">'));

const subpage=await call('infused.show','/market/',{SITE_MODE:'production'});
assert.ok((await subpage.text()).includes('https://infused.show/market/'));

const lander=await call('infused.show','/lander/?utm_source=route-test',{SITE_MODE:'production'});
const landerHtml=await lander.text();
assert.equal(lander.status,200);
assert.ok(landerHtml.includes('<base href="/">'));
assert.ok(landerHtml.includes('<link rel="stylesheet" href="/assets/css/site.css">'));
assert.ok(landerHtml.includes('<script src="/assets/js/cta-attribution.js" defer>'));
assert.ok(landerHtml.includes('<a href="/market/">Light page link</a>'));
assert.ok(landerHtml.includes('<link rel="canonical" href="https://infused.show/lander/">'));
assert.ok(landerHtml.includes('<meta name="robots" content="index, follow">'));
assert.equal(lander.headers.get('x-robots-tag'),'index, follow');
assert.ok(assetRequests.includes('/lander/'));

const css=await call('infused.show','/assets/css/site.css',{SITE_MODE:'production'});
assert.equal(css.status,200);
assert.equal(css.headers.get('Content-Type'),'text/css; charset=utf-8');
const js=await call('infused.show','/assets/js/cta-attribution.js',{SITE_MODE:'production'});
assert.equal(js.status,200);
assert.match(await js.text(),/first-party CTA/);
const image=await call('infused.show','/assets/images/light.webp',{SITE_MODE:'production'});
assert.equal(image.status,200);
assert.equal(image.headers.get('Content-Type'),'image/webp');

const landerNoSlash=await call('infused.show','/lander?utm_source=route-test',{SITE_MODE:'production'});
assert.equal(landerNoSlash.status,308);
assert.equal(landerNoSlash.headers.get('location'),'https://infused.show/lander/?utm_source=route-test');
const landerIndex=await call('infused.show','/lander/index.html',{SITE_MODE:'production'});
assert.equal(landerIndex.status,308);
assert.equal(landerIndex.headers.get('location'),'https://infused.show/lander/');
const noLanderSubpage=await call('infused.show','/lander/market/',{SITE_MODE:'production'});
assert.equal(noLanderSubpage.status,404);

const lightAlias=await call('light.infused.show','/anything/?utm_source=route-test',{SITE_MODE:'production'});
assert.equal(lightAlias.status,308);
assert.equal(lightAlias.headers.get('location'),'https://infused.show/lander/?utm_source=route-test');
const darkAliasLander=await call('dark.infused.show','/lander/',{SITE_MODE:'production'});
assert.equal(darkAliasLander.status,308);
assert.equal(darkAliasLander.headers.get('location'),'https://infused.show/lander/');
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

const recorded=[];
const clickDb={prepare(sql){
 assert.match(sql,/INSERT INTO web_acquisition_clicks_v1/);
 return {bind(...values){return {async run(){recorded.push(values);return {success:true};}};}};
}};
const tracked=await call('infused.show','/go/booth?position=navigation&page=%2Flander%2F&utm_source=qa&utm_campaign=single-worker',{SITE_MODE:'production',INTAKE_DB:clickDb});
assert.equal(tracked.status,302);
const checkout=new URL(tracked.headers.get('location'));
assert.equal(checkout.origin,'https://shows.map-dynamics.com');
assert.equal(checkout.pathname,'/infusedlv2027/');
assert.ok(checkout.searchParams.has('register'));
assert.equal(checkout.searchParams.has('catalyst_click_id'),false);
assert.equal(recorded.length,1);
assert.equal(recorded[0][1],'LV27');
assert.equal(recorded[0][2],'infused.show');
assert.equal(recorded[0][3],'/lander/');
assert.equal(recorded[0][4],'navigation');
assert.equal(recorded[0][6],'qa');
assert.equal(recorded[0][8],'single-worker');

const noDb=await call('infused.show','/go/booth',{SITE_MODE:'production'});
assert.equal(noDb.status,302);
assert.equal(new URL(noDb.headers.get('location')).origin,'https://shows.map-dynamics.com');

const previewClick=await call('dark.infused.show','/go/booth?utm_campaign=preview',{SITE_MODE:'canary',INTAKE_DB:clickDb});
assert.equal(previewClick.status,302);
assert.equal(recorded.length,1);

const intakeUnavailable=await worker.fetch(new Request('https://dark.infused.show/api/intake',{method:'POST',headers:{Origin:'https://dark.infused.show','Content-Type':'application/json'},body:'{}'}),{
 SITE_BASE_PATH:'/',SITE_MODE:'canary',SITE_ALLOWED_HOSTS:allowed,ASSETS:assets
});
assert.equal(intakeUnavailable.status,503);
const ticketStatus=await call('dark.infused.show','/tickets/api/status',{TICKET_NOTIFY_ENABLED:'false'});
assert.deepEqual(await ticketStatus.json(),{enabled:false});

const preview=await worker.fetch(new Request('https://infused.show/dropjourneytest/'),{
 SITE_BASE_PATH:'/dropjourneytest/',SITE_MODE:'preview',SITE_ALLOWED_HOSTS:allowed,ASSETS:assets
});
assert.equal(preview.status,200);
assert.equal(preview.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');
const previewLander=await worker.fetch(new Request('https://infused.show/dropjourneytest/lander/'),{
 SITE_BASE_PATH:'/dropjourneytest/',SITE_MODE:'preview',SITE_ALLOWED_HOSTS:allowed,ASSETS:assets
});
assert.equal(previewLander.status,200);
assert.equal(previewLander.headers.get('x-robots-tag'),'noindex, nofollow, noarchive');

console.log('PASS INFUSED single Worker: dark root, embedded light /lander, shared assets, direct D1 booth attribution, canonical host redirects, intake and disabled ticket notices');
