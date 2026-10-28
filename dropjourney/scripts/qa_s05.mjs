import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(project, '../src');
const read = (root,file) => readFile(path.join(root,file), 'utf8');
const built = file => read(project,`dist/dropjourneytest/${file}`);
const event = JSON.parse(await read(project,'content/event.json'));
const market = await built('market/index.html');
const vegas = await built('why-vegas/index.html');
const marketSource = await read(sourceRoot,'sections/market.html');
const vegasSource = await read(sourceRoot,'sections/why-vegas.html');
const stripped = s => s.replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();

assert.match(market,/class="dj-market-lede"/, 'Market needs editorial headline and source imagery');
assert.match(market,/class="dj-evidence-grid" role="list"/, 'Market requires accessible metrics grouping');
assert.equal((market.match(/class="dj-evidence" role="listitem"/g)||[]).length,5,'Exactly five market figures');
assert.equal((market.match(/class="dj-evidence-source"/g)||[]).length,5,'Exactly five figure-specific citations');
assert.equal((market.match(/class="dj-market-methodology"/g)||[]).length,1,'One methodology disclosure');
assert.equal((market.match(/These are separate market estimates across overlapping and adjacent industries/g)||[]).length,1,'One, non-repeating overlap caveat');
for(const cssClass of ['stat-name','stat-number','stat-basis','stat-forecast']){
 const re=new RegExp(`<[^>]+class="${cssClass}"[^>]*>([\\s\\S]*?)<\\/[^>]+>`,'g');
 const original=[...marketSource.matchAll(re)].map(m=>stripped(m[1]));
 assert.equal(original.length,5,`${cssClass} missing from original market source`);
 for(const phrase of original){assert.ok(market.includes(phrase),`Lost original ${cssClass}: ${phrase}`);}
}
const originalURLs=[...marketSource.matchAll(/<a href="(https:\/\/[^\"]+)"/g)].map(m=>m[1]);
assert.equal(originalURLs.length,5,'Expected five original publisher URLs');
for(const url of originalURLs)assert.ok(market.includes(`href="${url}"`),`Missing source URL: ${url}`);
assert.ok(market.includes('href="/dropjourneytest/opportunities/"'),'Market must link to exhibitor journey');
assert.ok(market.includes('href="/dropjourneytest/ecosystem/"'),'Market must link to ecosystem');
assert.doesNotMatch(market,/<div class="stats-grid">/,'Old unstructured stats grid must not remain alongside the new figures');

assert.match(vegas,/class="dj-vegas-hero"/, 'Vegas needs photo-led hero');
assert.match(vegas,/class="dj-vegas-event"/, 'Vegas needs factual event context');
assert.equal((vegas.match(/class="detail-box\b[^\"]*\bdj-vegas-reason"/g)||[]).length,4,'Exactly four original Vegas reasons');
const oldReasonNames=[...vegasSource.matchAll(/<h3>([\s\S]*?)<\/h3>/g)].map(m=>stripped(m[1]));
const oldReasons=[...vegasSource.matchAll(/<article class="detail-box\b[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p><\/article>/g)].map(m=>stripped(m[1]));
assert.equal(oldReasonNames.length,4);assert.equal(oldReasons.length,4);
for(const phrase of [...oldReasonNames,...oldReasons])assert.ok(vegas.includes(phrase),`Vegas source copy lost: ${phrase}`);
const originalImage=vegasSource.match(/src="\{\{BASE\}\}([^"]+)"/)?.[1];
assert.ok(originalImage && vegas.includes('src="/dropjourneytest/'+originalImage+'"'),'Original Vegas photograph must be retained');
assert.ok(vegas.includes('href="/dropjourneytest/#when"'),'Vegas must return to WHEN chapter');
assert.ok(vegas.includes('href="/dropjourneytest/tickets/"'),'Vegas must link to tickets');
assert.ok(vegas.includes('href="/dropjourneytest/opportunities/"'),'Vegas must link to exhibitors');
for(const route of ['','market/','why-vegas/','opportunities/','ecosystem/','buyers/','tickets/','buyers/apply/']){
 const content=await built(`${route}index.html`);
 assert.match(content,/name="dropjourney-site-version" content="2\.9\.1-review"/,`${route} version`);
 assert.ok(content.includes(event.dateLabel),`${route} must render the event date from one source`);
 assert.ok(content.includes(event.venue),`${route} must render the venue from one source`);
 assert.equal((content.match(/<h1\b/g)||[]).length,1,`${route} must have one H1`);
 assert.doesNotMatch(content,/<form\b/i,`${route} must not introduce live PII forms`);
 assert.match(content,/noindex[, ]*nofollow[, ]*noarchive/,`${route} must remain noindex`);
}
assert.match(await read(project,'src/s05.css'),/\.dj-evidence-grid\{display:grid/, 'Metrics must use a responsive grid');
assert.match(await read(project,'src/s05.css'),/@media\(max-width:620px\)/, 'Mobile metric and Vegas layout must reflow');
assert.match(await read(project,'src/s05-pages.mjs'),/sourcePathByMarket/, 'Source linking must use canonical published URLs');
assert.equal(event.verificationStatus.includes('signed venue/date record has not been independently reviewed'),true,'Approval limitation must be documented');
const worker=await read(project,'worker.mjs');
assert.match(worker,/2\.9\.1-review/,'Only preview Worker version should advance');
assert.doesNotMatch(worker,/AUDIENCE_DB|STRIPE_|d1_databases/,'No protected runtime bindings');
console.log('PASS DJ-S05: 5/5 sourced and geo-dated metrics, four original Vegas reasons, original photography, one event manifest, responsive markup, links, and all preview safety controls');
