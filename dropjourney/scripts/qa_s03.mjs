import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const get=async name=>readFile(path.join(root,name),'utf8');
const routes=['','market','ecosystem','roots','science','make','package','move','sell','services','buyers','why-vegas','opportunities','contact','tickets','buyers/apply'];
for(const route of routes){
  const html=await get(`dist/dropjourneytest/${route?route+'/':''}index.html`);
  const id=route||'home';
  assert.match(html,/name="dropjourney-site-version" content="2\.9\.0-review"/,`${id} wrong version`);
  assert.match(html,/name="robots" content="noindex[, ]*nofollow[, ]*noarchive"/,`${id} missing noindex`);
  assert.equal((html.match(/<h1\b/g)||[]).length,1,`${id} must have one H1`);
  assert.ok(html.includes('class="dj-nojs"'),`${id} missing no-JS fallback`);
  assert.ok(!html.includes('<form'),`${id} must not submit PII`);
  assert.ok(!html.includes('id="motion-optin"'),`${id} contains motion activation`);
  assert.ok(html.includes('/dropjourneytest/'),`${id} preview must stay namespaced`);
  assert.ok(!html.includes('/tickets/api/subscribe'),`${id} cannot submit ticket requests`);
  assert.ok(!html.includes('href="https://infused.show/"'),`${id} logo escaped to production`);
  // Links to these endpoints are an explicitly approved checkout exception only.
  for(const m of html.matchAll(/href="(https:\/\/infused\.show\/[^"?#]+)[^"\s]*"/g)){
    const value=m[1];assert.ok(value.startsWith('https://infused.show/go/booth')||value.startsWith('https://infused.show/dropjourneytest/'),`${id}: forbidden production deep link: ${value}`);
  }
  if(id==='home'){
    assert.match(html,/href="\/dropjourneytest\/opportunities\/#sponsorship"/, 'Sponsor path missing');
    const nav=html.match(/<nav class="site-nav" id="site-nav"[\s\S]*?<\/nav>/)?.[0]||'';
    for(const route of ['/opportunities/','/tickets/','/buyers/','/opportunities/#sponsorship','/contact/']){
      assert.ok(nav.includes(`href="/dropjourneytest${route}"`),`Homepage direct navigation missing ${route}`);
    }
    assert.ok(!nav.includes('Return to current INFUSED site'),'Legacy prototype menu copy must be removed');
    assert.match(html,/history\.pushState/, 'Chapter history not pushed');
    assert.match(html,/window\.addEventListener\('popstate'/, 'Popstate missing');
    assert.match(html,/function drawHover/, 'v1.5 water hover missing');
    assert.match(html,/function drawClick/, 'Pebble ripple missing');
    assert.ok(!html.includes('motionButton.hidden'), 'S03 must not require hidden activation button');
  }
  if(id==='opportunities')assert.match(html,/id="sponsorship"/, 'Sponsor target missing');
  if(id==='tickets')assert.match(html,/Ticket notifications are not accepting requests yet/, 'Tickets disabled state must be truthful');
  if(id==='buyers/apply')assert.ok(html.includes('id="buyer-form"')&&!html.includes('<form'),'Buyer wizard must be inert');
}
const homeCss=await get('src/home.css');
assert.match(homeCss,/\.market-scroll\{display:grid/,'Market metrics grid must be responsive');
assert.match(homeCss,/\.chapter-nav ol\{display:grid/,'Chapter selector cannot scroll sideways');
const detailCss=await get('src/site.css');
assert.match(detailCss,/\.dj-source-section \.stats-grid\{display:grid/,'Market detail grid responsive');
assert.match(detailCss,/\.dj-nojs/,'No-JS nav not styled');
const worker=await get('worker.mjs');
assert.match(worker,/noindex, nofollow, noarchive/);
assert.match(worker,/2\.9\.0-review/);
assert.doesNotMatch(worker,/AUDIENCE_DB|STRIPE_|d1_databases/,'No production bindings');
const js=await get('src/site.js');
assert.match(js,/const alpha=\.18/,'Three-ring hover optics missing');
assert.match(js,/alpha=\.42/,'Click disturbance missing');
assert.match(js,/Math\.max\(0,t-click\.t\)/,'Click wave time must be clamped; negative frame age creates NaN geometry');
console.log(`PASS DJ-S03: ${routes.length} noindex pages, five-task navigation, history, 2D water, responsive metric grids, no-JS safety and isolated Worker`);
