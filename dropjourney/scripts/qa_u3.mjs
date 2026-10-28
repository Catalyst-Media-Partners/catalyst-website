import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');
const cases=[['buyer','buyers/apply'],['attendee','tickets'],['contact','contact']];
for(const [kind,id] of cases){
 const html=await read('dist/dropjourneytest/'+id+'/index.html');
 assert.match(html,new RegExp('data-intake-kind=\"'+kind+'\"'));
 assert.match(html,/action=\"\/dropjourneytest\/api\/intake\"/);
 assert.match(html,/cf-turnstile/);
 assert.match(html,/name=\"consentContact\" required/);
 assert.match(html,/name=\"consentMarketing\"/);
 assert.doesNotMatch(html,/jotform/i);
}
const home=await read('dist/dropjourneytest/index.html');
assert.doesNotMatch(home,/jotform|id=\"buyer-dialog\"|data-open-buyer/i);
assert.match(home,/href=\"\/dropjourneytest\/buyers\/apply\/\"/);
const code=await read('worker.mjs');
assert.match(code,/INTAKE_PATH,handleIntake,flushIntakeOutbox/);
assert.doesNotMatch(code,/AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AUDIENCE_DB|STRIPE_/);
const conf=await read('wrangler.toml');
assert.match(conf,/binding = \"INTAKE_DB\"/);
assert.match(conf,/entrypoint = \"InfusedIntakeSESBridge\"/);
assert.doesNotMatch(conf,/4fc7440c-c340-47c4-a75f-96f4e7ad7441|STRIPE_/);
console.log('PASS DJ-U3: 3 native first-party forms, Turnstile, D1, private SES; zero runtime Jotform URLs');
