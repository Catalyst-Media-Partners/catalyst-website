import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

for (const path of ['index.html','game.js']) {
  assert.deepEqual(readFileSync('public/privategames/'+path),readFileSync('privategames/'+path),'Game asset not included exactly: '+path);
}
const html=readFileSync('public/privategames/index.html','utf8');
const client=readFileSync('public/privategames/game.js','utf8');
assert.match(html,/src="\/privategames\/game\.js"/);
assert.match(html,/name="robots" content="noindex, nofollow"/);
assert.doesNotMatch(html,/const WORDS|word:'adventure'/,'Server word bank must not be shipped in game HTML');
assert.doesNotMatch(client,/word:'adventure'|const WORDS/,'Server word bank must not be shipped in client');
assert.equal(existsSync('public/src'),false,'Server code must not be copied into public assets');
console.log('Shared game assets staged, unindexed, and separated from server state.');
