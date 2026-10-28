import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=p=>readFile(path.join(root,p),'utf8');
const home=await read('dist/dropjourneytest/index.html');
const app=await read('src/app.js');
const css=await read('src/finish.css');
assert.match(home,/data-chapter="what"/);
assert.match(home,/class="final-action"/);
assert.match(home,/href="\/dropjourneytest\/opportunities\/"[^>]*>.*?Explore exhibit options/s);
assert.match(home,/href="\/dropjourneytest\/tickets\/"/);
assert.doesNotMatch(home,/BACK TO (?:THE )?BEGINNING/,'Final chapter must convert, not restart');
assert.match(app,/location\.assign\('\/dropjourneytest\/opportunities\/'\)/);
assert.match(app,/Explore ways to participate/);
for(const id of ['make','move']){
 const s=await read('dist/dropjourneytest/'+id+'/index.html');
 assert.match(s,/class="dj-sector-adjacent"/,'Sparse sector must show related category media');
 assert.match(s,/class="dj-cross-link"/);
}
const opp=await read('dist/dropjourneytest/opportunities/index.html');
assert.match(opp,/class="dj-offers-visual"/,'Exhibit options need an actual visual');
assert.match(opp,/class="dj-offers-grid"/);
const apply=await read('dist/dropjourneytest/buyers/apply/index.html');
assert.match(apply,/class="dj-apply-photo"/,'Guided buyer page needs a relevant visual');
assert.doesNotMatch(apply,/<form\\b/);
for(const [name,page] of [['homepage',home],['buyer profile',apply]]){
 assert.match(page,/class="buyer-handoff"/,name+' must offer a next step after profile review');
 assert.match(page,/class="buyer-contact-link" href="\\/dropjourneytest\\/contact\\/" target="_blank" rel="noopener noreferrer"/,name+' must link only to existing contact route');
 assert.match(page,/Your answers are not automatically transferred or submitted/,name+' must disclose handoff limitation');
 assert.match(page,/id="buyer-copy"/,name+' must retain local explicit copy');
}
assert.doesNotMatch(apply,/<form\\b|fetch\\(|sendBeacon\\(/i,'Preview must not submit or transmit buyer information');
assert.match(css,/\.dj-sector-adjacent/);
assert.match(css,/\.dj-offers-visual/);
for(const id of ['opportunities','buyers','tickets','contact']){
 const s=await read('dist/dropjourneytest/'+id+'/index.html');
 assert.match(s,/dj-related-primary/,'Commercial page needs obvious final conversion');
}
console.log('PASS DJ-X1: end-of-journey, sparse sectors, visual hero and contextual CTA QA');
