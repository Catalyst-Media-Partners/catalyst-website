import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const content = readFileSync('index.html');
const blob = createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
assert.equal(blob, '2ae7b9911f9294202ef33d200fff17f95bd657fc', 'Merchant-reviewed page changed: stop release and obtain explicit approval before editing');
const html = content.toString('utf8');
const assets = [
  'assets/catalyst-logo-dark.png',
  'assets/catalyst-logo-light.png',
  'assets/favicon.png',
];
for (const path of assets) {
  assert.ok(statSync(path).size > 100, 'Missing or empty image: '+path);
  if (path !== 'assets/catalyst-logo-light.png') {
    assert.ok(html.includes(path), 'Expected referenced image missing from merchant-reviewed HTML: '+path);
  }
}
for (const text of [
  'Catalyst Media Partners Inc',
  'Cancellation, transfer and refund policy',
  'Fulfillment and delivery policy',
  'Privacy policy',
  'General website and transaction terms',
  'Payment security and customer support',
  'https://catalystmediapartners.com/',
  'lucas@catalystmediapartners.com',
]) assert.ok(html.includes(text), 'Merchant content missing: '+text);
console.log('Exact merchant-reviewed Git blob '+blob+' and all required local image assets verified.');
