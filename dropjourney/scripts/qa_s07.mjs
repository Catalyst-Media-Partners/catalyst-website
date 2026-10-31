import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const read=p=>readFile(path.join(root,p),'utf8');
const stages=['roots','science','make','package','move','sell','services'];
for(let i=0;i<stages.length;i++){
 const id=stages[i],s=await read(`dist/dropjourneytest/${id}/index.html`),canonical=await read(`../src/sections/${id}.html`);
 const count=(canonical.match(/<article class="detail-box/g)||[]).length;
 assert.equal((s.match(/class="dj-sector-topic"/g)||[]).length,count,id+' lost published topic copy');
 assert.ok(s.includes('href="/dropjourneytest/ecosystem/"'),id+' lacking return path');
 assert.ok(s.includes(`href="/dropjourneytest/${i?stages[i-1]:'ecosystem'}/"`),id+' missing previous step');
 assert.ok(s.includes(`href="/dropjourneytest/${stages[i+1]||'buyers'}/"`),id+' missing next step');
 for(const m of canonical.matchAll(/<h3>([^<]+)<\/h3>/g))assert.ok(s.includes(m[1]),id+' dropped source title');
 for(const m of canonical.matchAll(/<article class="detail-box[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/g))assert.ok(s.includes(m[1]),id+' dropped original source detail');
 assert.equal((s.match(/<h1\b/g)||[]).length,1,id+' heading parity');
 assert.ok(!s.includes('href="https://infused.show/'+id+'/"'),id+' escaped to original production page');
}
for(const id of ['move','sell','services']){
 const html=await read(`dist/dropjourneytest/${id}/index.html`);
 assert.match(html,/dj-phase-downstream/);
 assert.match(html,/Explore hosted buyers/);
}
console.log('PASS DJ-S07: Move, Sell, Services and seven-stage cross-category navigation have source parity');