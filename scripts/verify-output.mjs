import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const path of ['index.html', 'assets/catalyst-logo-dark.png', 'assets/catalyst-logo-light.png', 'assets/favicon.png']) {
  const original = readFileSync(path);
  const output = readFileSync('public/'+path);
  assert.equal(Buffer.compare(original, output), 0, 'Generated output differs from merchant-approved source: '+path);
}
for(const path of ['legal/index.html','legal/tickets/index.html','legal/exhibitors-sponsors/index.html']){
  assert.equal(Buffer.compare(readFileSync(path),readFileSync('public/'+path)),0,'Legal terms file differs: '+path);
}
console.log('Cloudflare static bundle matches all original source bytes.');
