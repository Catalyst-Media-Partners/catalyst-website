import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');

// SHA-256 from the actual preview brand PNG, compared visually against
// Adobe Illustrator's INFUSED LOGOS MASTERS.pdf (CannaCon Drive)
// and INFUSED LOGOS.pdf (Catalyst Drive). Do not silently substitute
// the production invitation lockup: that asset includes sales-campaign copy.
const EXPECTED='6e34f242567f4af804ea57fb096ac9fa141d22c6a15e54123b2c68f65c319ed6';
const pages=['','market','ecosystem','roots','science','make','package','move','sell','services','buyers','why-vegas','opportunities','contact','tickets','buyers/apply'];
const landers=['','discover','exhibit','buyers','sponsor','attend'];
const hash=base64=>crypto.createHash('sha256').update(Buffer.from(base64,'base64')).digest('hex');
let occurrences=0;
async function verify(label,p){
 const html=await read(p);
 const logos=[];
 for(const m of html.matchAll(/<img\b[^>]*>/g)){
   const tag=m[0],alt=tag.match(/\balt="([^"]*)"/)?.[1]||'';
   if(!/^INFUSED(?: Las Vegas)?$/i.test(alt))continue;
   const src=tag.match(/\bsrc="([^"]*)"/)?.[1]||'';
   assert.ok(src.startsWith('data:image/png;base64,'),label+': official logo unexpectedly replaced with another image, SVG, URL or campaign-specific lockup');
   const payload=src.slice('data:image/png;base64,'.length);
   assert.equal(hash(payload),EXPECTED,label+': INFUSED wordmark pixels differ from reviewed logo source');
   logos.push(alt);
 }
 assert.ok(logos.length>=1,label+': no official INFUSED logo found');
 occurrences+=logos.length;
 return logos;
}
const src=await read('src/index.html');
const embedded=src.match(/<img class="hero-wordmark" src="data:image\/png;base64,([^"]+)"/)?.[1];
assert.ok(embedded,'Locked original 500x113 INFUSED wordmark not found in source');
assert.equal(hash(embedded),EXPECTED,'Original template logo drift; compare against brand masters before changing');
const builder=await read('build.mjs');
assert.doesNotMatch(builder,/\|\|imagesRoot\+'infused-logo-00\.webp'/,'Do not silently substitute production exhibitor-invitation logo');
for(const id of pages)await verify(id||'home','dist/dropjourneytest/'+(id?id+'/':'')+'index.html');
for(const id of landers)await verify('land/'+(id||'default'),'dist/dropjourneytest/land/'+(id?id+'/':'')+'index.html');
console.log('PASS DJ-BRAND: '+pages.length+' website routes + '+landers.length+' landing routes, '+occurrences+' unchanged INFUSED brand-logo instances, SHA-256 '+EXPECTED);
