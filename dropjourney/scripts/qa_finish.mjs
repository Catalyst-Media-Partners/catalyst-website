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
assert.match(home,/href="\/dropjourneytest\/opportunities\/" data-role="exhibitor"/);
assert.match(home,/href="\/dropjourneytest\/tickets\/"/);
assert.doesNotMatch(home,/BACK TO (?:THE )?BEGINNING/,'Final chapter must convert, not restart');
assert.doesNotMatch(app,/location\.assign\('\/dropjourneytest\/opportunities\/'\)/,'Final Next/drop must not force exhibitor conversion');
assert.match(app,/function focusFinalDecision\(\)/);
assert.match(home,/data-role="attendee"/);
assert.match(home,/data-role="exhibitor"/);
assert.match(home,/data-role="buyer"/);
assert.match(app,/CHOOSE YOUR PATH/);
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
assert.match(apply,/class="dj-intake-form"/);
assert.doesNotMatch(home,/id="buyer-dialog"|data-open-buyer/,'Homepage must not retain dead-end buyer modal');
assert.match(apply,/data-intake-type="hosted-buyer"/,'Hosted Buyer route needs real request');
assert.match(apply,/data-intake-kind="buyer"/,'Native buyer form missing');
assert.doesNotMatch(apply,/form\.jotform\.com|target="_blank"/i,'Buyer intake must be first-party, not an external window');
assert.match(apply,/action="\/dropjourneytest\/api\/intake"/,'Native POST endpoint missing');
assert.match(css,/\.dj-sector-adjacent/);
assert.match(css,/\.dj-offers-visual/);
const opportunities=await read('dist/dropjourneytest/opportunities/index.html');
assert.doesNotMatch(opportunities,/class="dj-related"/,'Exhibitor page must not repeat generic final purchase CTA');
for(const id of ['buyers','tickets','contact']){
 const s=await read('dist/dropjourneytest/'+id+'/index.html');
 assert.match(s,/dj-related-primary/,'Commercial page needs obvious final conversion');
}
console.log('PASS DJ-X1: end-of-journey, sparse sectors, visual hero and contextual CTA QA');
