import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const domains = ['catalystmediapartners.com', 'www.catalystmediapartners.com'];
const paths = ['/', '/assets/favicon.png', '/assets/catalyst-logo-dark.png', '/assets/catalyst-logo-light.png'];
const files = new Map(paths.map(path=>[path,readFileSync(path==='/'?'index.html':path.slice(1))]));
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
