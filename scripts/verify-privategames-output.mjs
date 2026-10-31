import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

for (const path of ['index.html','game.js','notifications.js','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','badge.png','dictionary.html']) {
  assert.deepEqual(readFileSync('public/privategames/'+path),readFileSync('privategames/'+path),'Game asset not included exactly: '+path);
}
const html=readFileSync('public/privategames/index.html','utf8');
const client=readFileSync('public/privategames/game.js','utf8');
assert.match(html,/src="\/privategames\/game\.js\?v=4" type="module"/);
assert.match(html,/name="robots" content="noindex, nofollow"/);
assert.doesNotMatch(html,/const WORDS|word:'adventure'/,'Server word bank must not be shipped in game HTML');
assert.doesNotMatch(client,/word:'adventure'|const WORDS/,'Server word bank must not be shipped in client');
assert.equal(existsSync('public/src'),false,'Server code must not be copied into public assets');
const manifest=JSON.parse(readFileSync('public/privategames/manifest.webmanifest','utf8'));
assert.equal(manifest.scope,'/privategames/','Installed game must stay within its own path');
assert.equal(manifest.display,'standalone');
assert.equal(manifest.icons.length,2);
assert.match(readFileSync('public/privategames/sw.js','utf8'),/addEventListener\('push'/);
assert.doesNotMatch(readFileSync('public/privategames/sw.js','utf8'),/addEventListener\('fetch'/,'Never cache or simulate the shared game while offline');
console.log('Shared game assets staged, unindexed, and separated from server state.');
