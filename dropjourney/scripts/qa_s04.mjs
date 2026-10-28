import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>readFile(path.join(root,p),'utf8');
const routes=['','market','ecosystem','roots','science','make','package','move','sell','services','buyers','why-vegas','opportunities','contact','tickets','buyers/apply'];
const home=await read('dist/dropjourneytest/index.html');
const source=await read('src/index.html');
const styles=await read('src/home.css');
const site=await read('src/site.css');
const art=await read('src/drop-art.svg');
const script=await read('src/app.js');
const worker=await read('worker.mjs');
for(const id of routes){
 const html=await read('dist/dropjourneytest/'+(id?id+'/':'')+'index.html');
 assert.match(html,/name="dropjourney-site-version" content="2\.9\.1-review"/,id+' not current');
 assert.match(html,/<meta name="robots" content="noindex[, ]*nofollow[, ]*noarchive"/,id+' preview indexing enabled');
 assert.equal((html.match(/<h1\b/g)||[]).length,1,id+' H1 count');
 assert.doesNotMatch(html,/<form\b/,id+' native form could submit personal data');
 assert.doesNotMatch(html,/id="motion-optin"/,id+' motion activation control');
 assert.ok(html.includes('/dropjourneytest/'),id+' not namespaced');
}
assert.ok(source.includes('{{DROP_ART_INTRO}}')&&source.includes('{{DROP_ART_STAGE}}'),'Single source art placeholders');
assert.match(art,/shape-rendering="geometricPrecision"/,'Smooth vectors requested');
assert.doesNotMatch(art,/polygon|filter\s*=\s*"url/,'No faceted shapes or expensive filters');
for(const id of ['intro','stage']){
 assert.ok(home.includes(`drop-body-${id}`),'Shared 3D gradient '+id);
 assert.ok(home.includes(`drop-specular-${id}`),'3D specular highlight '+id);
 assert.ok(home.includes(`drop-rim-${id}`),'Antialiased rim '+id);
 assert.ok(home.includes(`drop-mask-${id}`),'Smooth silhouette '+id);
}
assert.equal((home.match(/class="drop-svg/g)||[]).length,2,'Two matching 3D SVG instances');
assert.equal((home.match(/class="market-point"/g)||[]).length,3,'Homepage should be curated to three figures');
const market=await read('dist/dropjourneytest/market/index.html');
assert.equal((market.match(/class="dj-evidence" role="listitem"/g)||[]).length,5,'Full market must retain all original five estimates');
assert.match(home,/Separate, overlapping market estimates/,'Context for market figures must remain truthful');
assert.match(home,/href="\/dropjourneytest\/tickets\/"/,'Attendance link should exist');
assert.match(styles,/\.drop-glyph\{display:none!important\}/,'Visible abstract symbol hides droplet shading');
assert.match(styles,/\.market-scroll\{grid-template-columns:1fr/,'Mobile market metrics must reflow without horizontal scroll');
assert.match(styles,/\.chapter-layout:after\{content:/,'Feathered imagery, not low-poly panels');
assert.match(site,/DJ-S04 shared finishing/,'Detail pages must adopt the same finish');
assert.match(script,/function drawHover/,'Retain original three-ring pointer physics');
assert.match(script,/function drawClick/,'Retain click wave');
assert.match(script,/CHOOSE YOUR PATH/,'Final chapter drop must focus audience choices, not loop or force exhibitor');
assert.doesNotMatch(home,/AN INTERACTIVE PREVIEW|MOTION REDUCED \/ V1\.5/,'Prototype disclaimers remain');
assert.ok(!worker.includes('AUDIENCE_DB')&&!worker.includes('STRIPE_'),'Worker remains isolated');
assert.ok(worker.includes('2.9.1-review')&&worker.includes("noindex, nofollow, noarchive"));
console.log(`PASS DJ-S04: ${routes.length} pages, shared 3D SVG drop, 3 curated metrics / 5 sourced totals, navigation, water physics and protected preview boundaries`);
