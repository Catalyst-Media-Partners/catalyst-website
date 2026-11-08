import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const content = readFileSync('index.html');
const htmlSource = content.toString('utf8');
const linked = '\n        <a href="/legal/">Purchase policies</a>';
assert.equal(htmlSource.split(linked).length, 2, 'Expected only the reviewed Purchase policies footer link');
const originalRefund = readFileSync('scripts/merchant-refund-original.txt','utf8');
const blockStart = htmlSource.indexOf('<details id="refund-policy">');
const blockEnd = htmlSource.indexOf('<details id="fulfillment-policy">',blockStart);
assert.ok(blockStart>0&&blockEnd>blockStart,'Exact refund disclosure bounds required');
const newSummary = htmlSource.slice(blockStart,blockEnd);
assert.ok(newSummary.includes('Commercial cancellations, deposits')&&newSummary.includes('/legal/exhibitors-sponsors/'),'New reviewed refund summary missing');
const original = Buffer.from((htmlSource.slice(0,blockStart)+originalRefund+htmlSource.slice(blockEnd)).replace(linked, ''));
const blob = createHash('sha1').update(`blob ${original.length}\0`).update(original).digest('hex');
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
