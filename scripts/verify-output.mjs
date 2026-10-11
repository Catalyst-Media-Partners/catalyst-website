import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const path of ['index.html', 'assets/catalyst-logo-dark.png', 'assets/catalyst-logo-light.png', 'assets/favicon.png']) {
  const original = readFileSync(path);
  const output = readFileSync('public/'+path);
  assert.equal(Buffer.compare(original, output), 0, 'Generated output differs from merchant-approved source: '+path);
}
console.log('Cloudflare static bundle matches all original source bytes.');
