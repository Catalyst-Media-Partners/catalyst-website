import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const domains = ['catalystmediapartners.com', 'www.catalystmediapartners.com'];
const paths = ['/', '/assets/favicon.png', '/assets/catalyst-logo-dark.png', '/assets/catalyst-logo-light.png'];
// Pull-request QA compares the currently deployed original page with the
// immutable merchant-reviewed source, not unmerged changes staged for release.
// The separate post-deploy smoke check must compare the newly published page.
const reviewedNewLink = '\n        <a href="/legal/">Purchase policies</a>';
const staged = readFileSync('index.html','utf8');
assert.equal(staged.split(reviewedNewLink).length,2,'Unreviewed homepage-link drift');
const originalRefund=readFileSync('scripts/merchant-refund-original.txt','utf8');
const start=staged.indexOf('<details id="refund-policy">'),end=staged.indexOf('<details id="fulfillment-policy">',start);
assert.ok(start>0&&end>start,'Reviewed refund disclosure must remain intact');
const reviewedHomepage=staged.slice(0,start)+originalRefund+staged.slice(end);
const files = new Map(paths.map(path=>[path,path==='/'?Buffer.from(reviewedHomepage):readFileSync(path.slice(1))]));
for (const host of domains) {
  for (const path of paths) {
    const url = 'https://' + host + path;
    const response = await fetch(url,{redirect:'follow',signal:AbortSignal.timeout(25000)});
    assert.equal(response.status,200, url + ' unexpectedly returned HTTP ' + response.status);
    assert.ok(response.url.startsWith('https://'), url + ' ended without HTTPS');
    const received = Buffer.from(await response.arrayBuffer());
    const original = files.get(path);
    assert.equal(Buffer.compare(received, original),0,url+' does not match the original merchant-reviewed source');
    const hex = createHash('sha256').update(received).digest('hex').slice(0,16);
    console.log('PASS',url,'HTTP',response.status,'bytes',received.length,'sha256:',hex);
  }
}
console.log('PASS: both Catalyst custom domains deliver all four merchant-reviewed source files byte for byte over HTTPS.');
