import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const file='infused-wordmark-shaded-web-hd.png';
const shaExpected='bd29ef66ed28f94005043e6e4dae0f3ba48781ac5413f038d9dba9d8df12e7ff';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const srcAsset=await readFile(path.join(root,'src','assets','images',file));
const distAsset=await readFile(path.join(root,'dist','dropjourneytest','assets','images',file));
assert.equal(sha(srcAsset),shaExpected,'Approved source logo binary changed');
assert.equal(sha(distAsset),shaExpected,'Compiled logo does not match its approved master');
assert.equal(srcAsset.length,38858,'Expected high-resolution transparent PNG source');
const original=await readFile(path.join(root,'src','index.html'),'utf8');
assert.equal((original.match(new RegExp('assets/images/'+file,'g'))||[]).length,2,'Both homepage logo instances must reference the approved asset');
assert.doesNotMatch(original,/data:image\/png;base64/i,'Do not reintroduce 500x113 inline homepage wordmark');
const pages=['','market','ecosystem','roots','science','make','package','move','sell','services','buyers','why-vegas','opportunities','contact','tickets','buyers/apply'];
const landers=['','discover','exhibit','buyers','sponsor','attend'];
let instances=0;
for(const id of pages){
 const html=await readFile(path.join(root,'dist','dropjourneytest',id,'index.html'),'utf8');
 const tags=[...html.matchAll(/<img\b[^>]*>/g)].map(m=>m[0]).filter(t=>/\balt="INFUSED(?: Las Vegas)?"/i.test(t));
 assert.ok(tags.length>=1,(id||'home')+': no site logo found');
 for(const tag of tags){
  const href=tag.match(/\bsrc="([^"]*)"/)?.[1];
  assert.ok(href==='assets/images/'+file||href==='/dropjourneytest/assets/images/'+file,(id||'home')+': unexpected or unapproved INFUSED logo '+String(href).slice(0,80));
  instances++;
 }
}
for(const id of landers){
 const html=await readFile(path.join(root,'dist','dropjourneytest','land',id,'index.html'),'utf8');
 const tag=[...html.matchAll(/<img\b[^>]*>/g)].map(x=>x[0]).find(t=>/\balt="INFUSED"/.test(t));
 assert.ok(tag,'Lander '+(id||'default')+' has no wordmark');
 const data=tag.match(/\bsrc="data:image\/png;base64,([^"]+)"/)?.[1];
 assert.ok(data,'Lander '+(id||'default')+' must be portable and embed the approved logo');
 assert.equal(sha(Buffer.from(data,'base64')),shaExpected,'Lander '+(id||'default')+' brand artwork drifted');
 instances++;
}
console.log('PASS DJ-brand-HD: approved 1588x358 shaded white INFUSED wordmark, binary SHA pinned, '+pages.length+' website routes and '+landers.length+' portable campaign routes, '+instances+' logo instances');
