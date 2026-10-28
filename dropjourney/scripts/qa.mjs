import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(new URL('..',import.meta.url).pathname),dist=path.join(root,'dist','dropjourneytest');
const ids=['','market','ecosystem','roots','science','make','package','move','sell','services','buyers','why-vegas','opportunities','contact','tickets','buyers/apply'];
let pages=0,links=0,images=0;
for(const id of ids){
 const file=path.join(dist,id,'index.html');
 const html=await readFile(file,'utf8');const label=id||'journey';
 assert.match(html,/<meta name="robots" content="noindex[, ]*nofollow[, ]*noarchive"/i,`${label} should be noindex`);
 assert.match(html,/<main\b/i,`${label} missing main`);
 const h1=(html.match(/<h1\b/g)||[]).length;assert.equal(h1,1,`${label}: exactly one h1`);
 assert.ok(!html.includes('/dropjourneytest/dropjourneytest/'),`${label}: doubled preview prefix`);
 assert.ok(!html.includes('AN INTERACTIVE PREVIEW'),`${label}: prototype disclaimer in public copy`);
 assert.ok(!html.includes('/tickets/api/subscribe'),`${label}: no production ticket collection`);
 assert.ok(!html.includes('form.jotform.com')||id==='contact',`${label}: contact action only on contact route`);
 assert.ok(!html.includes('href="https://infused.show/"'),`${label}: no escape to old site via home logo`);
 if(id===''||id==='buyers/apply'){assert.ok(!html.includes('<form'),`${label}: wizard must not submit natively without JS`);assert.ok(html.includes('id="buyer-form"'),'wizard required');}
 if(id==='tickets'){assert.ok(!html.includes('id="ticket-notify-form"'),'ticket form must be inert');assert.ok(html.includes('not accepting requests'),'honest disabled state');}
 for(const m of html.matchAll(/(?:href|src)="(\/dropjourneytest\/[^"?#]*)/g)){
   const u=m[1];if(!u||u==='/'||u.endsWith('/'))continue;
   const target=path.join(root,'dist',u.slice(1));await stat(target).catch(()=>{throw Error(`${label}: missing resource ${u}`)});links++;
 }
 for(const m of html.matchAll(/src="(\/dropjourneytest\/assets\/images\/[^"?#]*)/g)){const target=path.join(root,'dist',m[1].slice(1));await stat(target);images++;}
 pages++;
}
const code=await readFile(path.join(root,'worker.mjs'),'utf8');
for(const needle of ['noindex, nofollow, noarchive','if(request.method','env.ASSETS.fetch','tickets\\/api','X-DropJourney-Version'])assert.ok(code.includes(needle),`Worker missing ${needle}`);
assert.ok(!code.includes('AUDIENCE_DB'),'Preview should have no D1 binding');
const conf=await readFile(path.join(root,'wrangler.toml'),'utf8');
assert.ok(conf.includes('name = "infused-dropjourneytest"'),'Worker name must be isolated');
assert.ok(conf.includes('workers_dev = false'),'No workers.dev public preview');
assert.ok(!conf.includes('infused-show"'),'No production Worker reference');
assert.equal((await readdir(path.join(dist,'assets','images'))).filter(x=>x.endsWith('.webp')).length,21);
console.log(`PASS: ${pages} pages, 21 source images, ${links} asset links, ${images} image references, immutable production and protected integration boundaries`);
