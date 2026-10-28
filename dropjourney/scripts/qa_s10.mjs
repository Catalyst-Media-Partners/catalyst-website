import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname),read=p=>readFile(path.join(root,p),'utf8');
const routes=['','market','ecosystem','roots','science','make','package','move','sell','services','buyers','why-vegas','opportunities','contact','tickets','buyers/apply'];
const dist=path.join(root,'dist','dropjourneytest');let links=0,images=0;
for(const id of routes){
 const html=await read(`dist/dropjourneytest/${id?id+'/':''}index.html`),label=id||'journey';
 assert.match(html,/name="dropjourney-site-version" content="2\.9\.0-review"/,label+' wrong version');
 assert.match(html,/name="robots" content="noindex[, ]*nofollow[, ]*noarchive"/,label+' not isolated from indexing');
 assert.equal((html.match(/<h1\b/g)||[]).length,1,label+' H1 count wrong');
 const mainTarget=id?'main':'story-main';
 assert.match(html,new RegExp(`<main\\b[^>]*\\bid="${mainTarget}"`),label+' missing original main target');
 assert.ok(html.includes(`href="#${mainTarget}"`),label+' skip link missing or broken');
 assert.doesNotMatch(html,/<form\b|id="motion-optin"/,label+' contains unapproved form or motion activation');
 assert.ok(html.includes('/dropjourneytest/'),label+' escaped route namespace');
 assert.ok(!html.includes('/dropjourneytest/dropjourneytest/'),label+' double-prefixed resource');
 for(const m of html.matchAll(/(?:href|src)="(\/dropjourneytest\/[^"?#]*)/g)){
  if(m[1].endsWith('/'))continue;
  const p=path.join(root,'dist',m[1].slice(1));await stat(p).catch(()=>{throw Error(label+' missing resource '+m[1]);});links++;
 }
 for(const m of html.matchAll(/<img\b([^>]+)>/g)){
  assert.match(m[1],/\balt="[^"]*"/,label+' image lacks alt');
  assert.match(m[1],/\bwidth=|\bheight=/,label+' image lacks dimensions');images++;
 }
}
const home=await read('dist/dropjourneytest/index.html'),css=await read('src/site.css'),styles=await read('src/home.css'),water=await read('src/site.js'),worker=await read('worker.mjs'),conf=await read('wrangler.toml');
assert.match(home,/function drawHover/,'3-ring 3D water pointer effect lost');
assert.match(home,/function drawClick/,'single splash lost');
for(const name of ['drop-body-intro','drop-body-stage','drop-specular-intro','drop-specular-stage'])assert.ok(home.includes(name),'3D droplet gradient missing '+name);
assert.match(css,/grid-template-columns:repeat\(auto-fit/,'responsive metric arrangement missing');
assert.match(styles,/\.chapter-nav ol\{display:grid/,'chapter navigation must not be horizontal scroller');
assert.match(water,/prefers-reduced-motion:reduce/,'system reduced-motion support missing');
assert.match(conf,/name = "infused-dropjourneytest"/,'wrong preview Worker');
assert.doesNotMatch(conf,/d1_databases|AUDIENCE_DB|STRIPE_|infused-show"/,'preview has production binding');
assert.doesNotMatch(worker,/AUDIENCE_DB|STRIPE_|sendEmail|webhook/,'preview must not run production handlers');
assert.match(worker,/noindex, nofollow, noarchive/,'preview response headers required');
assert.equal((await readdir(path.join(dist,'assets','images'))).filter(n=>n.endsWith('.webp')).length,21,'original media asset count');
const qaDocs=await read('docs/S10_RELEASE.md');assert.ok(qaDocs.includes('NO PRODUCTION CUTOVER'),'release boundary documentation required');
console.log(`PASS DJ-S10: ${routes.length} preview routes, ${links} local asset links, ${images} accessible image elements, SEO, water animation, integration separation`);