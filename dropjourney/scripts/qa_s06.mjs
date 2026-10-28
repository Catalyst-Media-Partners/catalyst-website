import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');
const taxonomy=JSON.parse(await read('content/taxonomy.json'));
const eco=await read('dist/dropjourneytest/ecosystem/index.html');
const original=await read('../src/sections/ecosystem.html');
assert.equal(taxonomy.stages.length,7,'Seven categories in the value chain');
assert.equal((eco.match(/class="dj-stream-node"/g)||[]).length,7,'Seven category links in accessible stream');
assert.equal((eco.match(/class="dj-stream-buyer"/g)||[]).length,1,'Hosted buyer dimension separate from stream');
assert.match(eco,/<div class="dj-stream" role="list"/,'Accessible value stream list');
for(const item of [...taxonomy.stages,{id:taxonomy.connector.id}]){
  assert.match(eco,new RegExp('href="/dropjourneytest/'+item.id+'/"'),item.id+' missing category link');
  const url=`/dropjourneytest/${item.id}/`;
  assert.ok(original.includes(`{{BASE}}${item.id}/`),item.id+' not in canonical source');
}
for(const id of ['roots','science','make','package']){
  const s=await read(`dist/dropjourneytest/${id}/index.html`);
  const canonical=await read(`../src/sections/${id}.html`);
  const count=(canonical.match(/<article class="detail-box/g)||[]).length;
  assert.equal((s.match(/class="dj-sector-topic"/g)||[]).length,count,id+' topic count mismatch');
  assert.match(s,/class="dj-sector-nav"/,id+' adjacency nav');
  assert.match(s,/<figure class="dj-sector-image">[\s\S]*<img/,id+' missing hero image');
  assert.match(s,/href="\/dropjourneytest\/opportunities\/"/,id+' missing business path');
  assert.equal((s.match(/<h1\b/g)||[]).length,1,id+' one H1');
  for(const m of canonical.matchAll(/<h3>([^<]+)<\/h3>/g))assert.ok(s.includes(m[1]),id+' original topic lost '+m[1]);
}
const css=await read('src/s06.css');
assert.match(css,/grid-template-columns:1fr/,'mobile ecosystem must stack');
assert.doesNotMatch(css,/overflow-x\s*:\s*auto/,'No horizontal scrollers');
console.log('PASS DJ-S06: seven source-derived ecosystem sectors, accessible buyer dimension and four upstream editorial pages');