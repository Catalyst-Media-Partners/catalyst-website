import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const config=readFileSync('wrangler.toml','utf8');
for(const expected of [
 'name = "infused-dark"',
 'main = "./dropjourney/worker.mjs"',
 'directory = "./dropjourney/dist/production"',
 'binding = "INTAKE_DB"',
 'database_id = "4fc7440c-c340-47c4-a75f-96f4e7ad7441"',
 'service = "catalyst-revenue"',
 'entrypoint = "InfusedIntakeSESBridge"',
 'keep_vars = true'
])assert.ok(config.includes(expected),'Missing unified Worker config: '+expected);
assert.equal((config.match(/\[\[d1_databases\]\]/g)||[]).length,1,'INFUSED site must bind one D1 database');
assert.equal((config.match(/\[\[services\]\]/g)||[]).length,1,'INFUSED site must use only the shared Catalyst revenue backend');
assert.doesNotMatch(config,/infused-show|infused-intake-production|13188d57|2082f84e|LIGHT_SITE|BOOTH_ATTRIBUTION/);
const lander=readFileSync('dropjourney/dist/production/lander/index.html','utf8');
assert.ok(lander.includes('<base href="/">'));
assert.ok(lander.includes('href="/assets/css/site.css"'));
assert.ok(lander.includes('src="/assets/js/cta-attribution.js"'));
assert.ok(!lander.includes('/lander/assets/'));
assert.ok(existsSync('dropjourney/dist/production/assets/css/site.css'));
assert.ok(existsSync('dropjourney/dist/production/assets/js/cta-attribution.js'));
const attribution=readFileSync('dropjourney/dist/production/assets/js/cta-attribution.js','utf8');
assert.ok(attribution.includes("'/lander/'"),'The light landing page must be an allowed CTA attribution source');
console.log('PASS INFUSED single-Worker deployment contract: one site Worker, one canonical D1, one shared revenue service, static /lander assets');
