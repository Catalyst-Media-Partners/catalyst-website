import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.mjs';

const config = readFileSync('wrangler.toml', 'utf8');
for (const expected of [
  'name = "infused-show"', 'workers_dev = true', 'keep_vars = true',
  'main = "./src/worker.mjs"', 'directory = "./public"',
  'binding = "ASSETS"', 'run_worker_first = true'
]) assert.ok(config.includes(expected), `Missing Cloudflare contract: ${expected}`);
assert.match(config, /binding = "AUDIENCE_DB"/);
assert.match(config, /database_id = "4fc7440c-c340-47c4-a75f-96f4e7ad7441"/);
const orig = readFileSync('public/index.html', 'utf8');
const sample = async (hostname, pathname = '/', extra = {}) => worker.fetch(
  new Request(`https://${hostname}${pathname}`),
  { ASSETS: { fetch: async () => new Response(orig, { status: 200, headers: {'Content-Type': 'text/html; charset=utf-8', 'ETag': 'test'} }) }, ...extra }
);
const preview = await sample('infused-show.cannacon-org-s-account.workers.dev');
const previewHTML = await preview.text();
assert.equal(preview.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
assert.ok(previewHTML.includes('<meta name="robots" content="noindex, nofollow, noarchive">'));
assert.ok(!previewHTML.includes('<link rel="canonical" href="https://infused.show/">'));
const rootRobots = await sample('infused-show.cannacon-org-s-account.workers.dev', '/robots.txt');
assert.ok((await rootRobots.text()).includes('Disallow: /'));
const lightDisabled = await sample('light.infused.show');
assert.equal(lightDisabled.status,404,'Light hostname must remain unpublished until explicitly enabled');
const light = await sample('light.infused.show','/',{LIGHT_HOST_PUBLISHED:'true'});
const lightHTML = await light.text();
assert.equal(light.headers.get('x-robots-tag'),null);
assert.ok(lightHTML.includes('<link rel="canonical" href="https://light.infused.show/">'));
const lightRobots = await sample('light.infused.show','/robots.txt',{LIGHT_HOST_PUBLISHED:'true'});
assert.ok((await lightRobots.text()).includes('Sitemap: https://light.infused.show/sitemap.xml'));
const lightSitemap = await sample('light.infused.show','/sitemap.xml',{LIGHT_HOST_PUBLISHED:'true'});
assert.ok((await lightSitemap.text()).includes('https://light.infused.show/market/'));
const prod = await sample('infused.show');
const prodHTML = await prod.text();
assert.equal(prod.headers.get('x-robots-tag'), null);
assert.ok(prodHTML.includes('<meta name="robots" content="index, follow">'));
assert.ok(prodHTML.includes('<link rel="canonical" href="https://infused.show/">'));
assert.ok(prodHTML.includes('FROM ROOTS'));
const indexedHome = await sample('infused.show', '/index.html');
assert.ok((await indexedHome.text()).includes('<link rel="canonical" href="https://infused.show/">'));
const indexedSubpage = await sample('infused.show', '/market/index.html');
assert.ok((await indexedSubpage.text()).includes('<link rel="canonical" href="https://infused.show/market/">'));
const www = await sample('www.infused.show');
assert.equal(www.status, 308);
assert.equal(www.headers.get('location'), 'https://infused.show/');
const sitemap = await sample('infused.show','/sitemap.xml');
assert.equal(sitemap.status, 200);
assert.equal((await sitemap.text()).match(/<url>/g).length, 15);
const productionRobots = await sample('infused.show','/robots.txt');
assert.ok((await productionRobots.text()).includes('Allow: /'));
const legacyRedirects = [
  ['/getting-started/', '/'],
  ['/event/las-vegas-2027/', '/'],
  ['/exhibit/', '/opportunities/'],
  ['/exhibitor-hub/', '/opportunities/'],
  ['/become-an-exhibitor/', '/contact/'],
  ['/become-a-speaker/', '/contact/'],
  ['/become-a-sponsor/', '/opportunities/']
];
for (const [legacyPath, destination] of legacyRedirects) {
  const legacy = await sample('infused.show', legacyPath);
  assert.equal(legacy.status, 301, 'Legacy redirect missing for ' + legacyPath);
  assert.equal(legacy.headers.get('location'), 'https://infused.show' + destination);
}
const oldCampaign = await sample('infused.show', '/become-an-exhibitor/?utm_source=legacy');
assert.equal(oldCampaign.headers.get('location'), 'https://infused.show/contact/?utm_source=legacy');
const oldPreview = await sample('infused-show.cannacon-org-s-account.workers.dev', '/exhibitor-hub/');
assert.equal(oldPreview.status, 301);
assert.ok(oldPreview.headers.get('location').endsWith('/opportunities/'));
const unsupportedLegal = await sample('infused.show', '/privacy-policy/');
assert.notEqual(unsupportedLegal.status, 301, 'Do not silently repurpose the old privacy policy');

// Fixed-destination, non-PII click handoff: production D1 write is one event,
// not an inferred customer, exhibitor, purchase, or marketing permission.
const recorded = [];
const clickDb = {
  prepare(sql) {
    assert.match(sql, /^INSERT INTO web_acquisition_clicks_v1/);
    return {
      bind(...values) {
        return { async run() { recorded.push(values); return { success: true }; } };
      }
    };
  }
};
const tracked = await worker.fetch(new Request(
  'https://infused.show/go/booth?position=hero&page=%2Fopportunities%2F' +
  '&utm_source=catalyst&utm_medium=email&utm_campaign=lv27-suppliers' +
  '&utm_content=variant_a&referrer_host=www.google.com&redirect=https%3A%2F%2Fevil.invalid'
), { AUDIENCE_DB: clickDb, MAPD_CLICK_ID_FORWARD_ENABLED: 'true' });
assert.equal(tracked.status,302);
assert.equal(tracked.headers.get('cache-control'),'no-store');
assert.equal(tracked.headers.get('set-cookie'),null);
const checkout = new URL(tracked.headers.get('location'));
assert.equal(checkout.origin,'https://shows.map-dynamics.com');
assert.equal(checkout.pathname,'/infusedlv2027/');
assert.ok(checkout.searchParams.has('register'));
assert.match(checkout.searchParams.get('catalyst_click_id'),/^[a-f0-9-]{36}$/);
assert.equal(checkout.searchParams.get('utm_campaign'),'lv27-suppliers');
assert.equal(checkout.searchParams.get('utm_source'),'catalyst');
assert.equal(checkout.searchParams.has('redirect'),false);
assert.equal(checkout.searchParams.has('referrer_host'),false);
assert.equal(recorded.length,1);
assert.equal(recorded[0][0],checkout.searchParams.get('catalyst_click_id'));
assert.deepEqual(recorded[0].slice(1,6),['LV27','infused.show','/opportunities/','hero','www.google.com']);
assert.equal(recorded[0][6],'catalyst');
assert.equal(recorded[0][8],'lv27-suppliers');
const malformed = await worker.fetch(new Request(
  'https://infused.show/go/booth?position=invalid&page=%2F%2Fevil.invalid' +
  '&utm_campaign=customer%40email.invalid&utm_source=catalyst'
), {AUDIENCE_DB:clickDb});
assert.equal(malformed.status,302);
assert.equal(recorded.length,2);
assert.deepEqual(recorded[1].slice(3,5),['/','other']);
assert.equal(recorded[1][8],null);
const previewClick = await worker.fetch(new Request(
  'https://infused-show.cannacon-org-s-account.workers.dev/go/booth?utm_campaign=preview'
), {AUDIENCE_DB:clickDb});
assert.equal(previewClick.status,302);
assert.equal(recorded.length,2);
assert.ok(!new URL(previewClick.headers.get('location')).searchParams.has('catalyst_click_id'));
const failedDb = { prepare() { return {bind() {return {async run() {throw Error('qa forced unavailable');}};}}; } };
const dbFailure = await worker.fetch(new Request('https://infused.show/go/booth'),{AUDIENCE_DB:failedDb});
assert.equal(dbFailure.status,302);
assert.equal(new URL(dbFailure.headers.get('location')).origin,'https://shows.map-dynamics.com');
assert.ok(!new URL(dbFailure.headers.get('location')).searchParams.has('catalyst_click_id'));
const safeDefault = await worker.fetch(new Request(
  'https://infused.show/go/booth?utm_source=catalyst&utm_campaign=lv27-suppliers'
), {AUDIENCE_DB:clickDb});
assert.equal(safeDefault.status,302);
assert.equal(recorded.length,3);
const lightTracked = await worker.fetch(new Request('https://light.infused.show/go/booth?position=navigation&page=%2Fopportunities%2F'),{AUDIENCE_DB:clickDb,LIGHT_HOST_PUBLISHED:'true'});
assert.equal(lightTracked.status,302);
assert.equal(recorded.length,4);
assert.equal(recorded[3][2],'light.infused.show','Light-site clicks retain their actual site hostname');
const originalMapd = new URL(safeDefault.headers.get('location'));
assert.equal(originalMapd.origin,'https://shows.map-dynamics.com');
assert.ok(originalMapd.searchParams.has('register'));
assert.equal(originalMapd.searchParams.has('catalyst_click_id'),false);
assert.equal(originalMapd.searchParams.has('utm_campaign'),false);
const invalidMethod = await worker.fetch(new Request('https://infused.show/go/booth',{method:'POST'}),{AUDIENCE_DB:clickDb});
assert.equal(invalidMethod.status,405);
assert.equal(recorded.length,3);
assert.ok(orig.includes('cta-attribution.js'), 'Every page must load the no-cookie attribution enhancement');

console.log('PASS: independent Worker, preview/production metadata, robots, sitemap, and redirect and anonymous CTA tracking behavior');
