import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');
const source=await read('src/index.html'),html=await read('dist/dropjourneytest/index.html'),app=await read('src/app.js'),css=await read('src/finish.css');
const start=source.indexOf('<section class="chapter-panel" id="what"');
const end=source.indexOf('\n          </section>',start);
assert.ok(start>=0&&end>start,'WHAT chapter not found');
const what=source.slice(start,end),built=html.slice(html.indexOf('id="what" data-chapter="what"'),html.indexOf('<div class="drop-col">'));
assert.doesNotMatch(what,/class="opportunities-list"|class="offer-footer"/,'WHAT must not reintroduce long commercial lists or booking terms');
assert.match(what,/class="final-action"/);
for(const [role,route,label] of [['attendee','tickets','Attend INFUSED'],['exhibitor','opportunities','Exhibit at INFUSED'],['buyer','buyers','Join as a Buyer']]){
 assert.match(what,new RegExp('href="/'+route+'/" data-role="'+role+'"'),'Missing role '+role);
 assert.ok(built.includes('href="/dropjourneytest/'+route+'/" data-role="'+role+'"'),'Unprefixed role route '+role);
 assert.ok(built.includes(label),'Missing clear CTA '+label);
}
assert.equal((what.match(/data-role="/g)||[]).length,3,'WHAT must have exactly three choices');
assert.doesNotMatch(app,/location\.assign\('\/dropjourneytest\/opportunities\/'\)/,'Final navigation cannot automatically redirect exhibitors');
assert.match(app,/function focusFinalDecision\(\)/,'Final action must shift focus to actual role options');
assert.match(app,/firstChoice\.focus\(\{preventScroll:true\}\)/,'Keyboard focus must be transferred');
assert.match(app,/CHOOSE YOUR PATH/,'Next/drop must communicate purpose');
assert.match(css,/body\[data-stage=what\] \.final-role-links\{display:grid/,'Role choices need grid');
assert.match(css,/body\[data-stage=what\] \.final-role-links a:focus-visible/,'Role links need keyboard focus');
assert.match(html,/function drawHover/,'Water hover physics must remain');
assert.match(html,/function drawClick/,'Water click physics must remain');
console.log('PASS DJ-U1: bounded WHAT, 3 audience routes, no forced exhibitor next, keyboard and water preserved');
