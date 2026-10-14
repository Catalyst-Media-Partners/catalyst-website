import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.mjs';

const config = readFileSync('wrangler.toml', 'utf8');
for (const expected of [
  'name = "infused-show"', 'workers_dev = true', 'keep_vars = true',
  'main = "./src/worker.mjs"', 'directory = "./public"',
  'binding = "ASSETS"', 'run_worker_first = true'
]) assert.ok(config.includes(expected), `Missing Cloudflare contract: ${expected}`);
const orig = readFileSync('public/index.html', 'utf8');
const sample = async (hostname, pathname = '/') => worker.fetch(
  new Request(`https://${hostname}${pathname}`),
  { ASSETS: { fetch: async () => new Response(orig, { status: 200, headers: {'Content-Type': 'text/html; charset=utf-8', 'ETag': 'test'} }) } }
);
const preview = await sample('infused-show.cannacon-org-s-account.workers.dev');
const previewHTML = await preview.text();
assert.equal(preview.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
assert.ok(previewHTML.includes('<meta name="robots" content="noindex, nofollow, noarchive">'));
assert.ok(!previewHTML.includes('<link rel="canonical" href="https://infused.show/">'));
const rootRobots = await sample('infused-show.cannacon-org-s-account.workers.dev', '/robots.txt');
assert.ok((await rootRobots.text()).includes('Disallow: /'));
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
assert.equal((await sitemap.text()).match(/<url>/g).length, 14);
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
console.log('PASS: independent Worker, preview/production metadata, robots, sitemap, and redirect behavior');
