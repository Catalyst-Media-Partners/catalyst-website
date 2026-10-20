import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = process.cwd();
const browser = await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  await page.route('https://infused.show/**',async route => {
    const url = new URL(route.request().url());
    let target = null, mime = 'text/html; charset=utf-8';
    if (url.pathname === '/') target = 'public/index.html';
    if (url.pathname === '/opportunities/') target = 'public/opportunities/index.html';
    if (url.pathname === '/assets/js/cta-attribution.js') {
      target = 'public/assets/js/cta-attribution.js';
      mime = 'text/javascript; charset=utf-8';
    }
    if (target) return route.fulfill({status:200,contentType:mime,body:await readFile(path.join(root,target))});
    return route.fulfill({status:204,body:''});
  });
  const campaign = 'https://infused.show/?utm_source=catalyst&utm_medium=email' +
    '&utm_campaign=lv27-suppliers&utm_content=variant_a';
  await page.goto(campaign,{waitUntil:'load'});
  const click = await page.locator('a[data-cta-position="hero"]').getAttribute('href');
  const handoff = new URL(click);
  assert.equal(handoff.pathname,'/go/booth');
  assert.equal(handoff.searchParams.get('position'),'hero');
  assert.equal(handoff.searchParams.get('page'),'/');
  assert.equal(handoff.searchParams.get('utm_source'),'catalyst');
  assert.equal(handoff.searchParams.get('utm_campaign'),'lv27-suppliers');
  assert.equal(handoff.searchParams.get('utm_content'),'variant_a');
  const link = page.locator('.hero-buttons a[href*="/opportunities/"]');
  const next = new URL(await link.getAttribute('href'));
  assert.equal(next.searchParams.get('utm_campaign'),'lv27-suppliers');
  await page.goto(next.href,{waitUntil:'load'});
  const purchase = new URL(await page.locator('a[data-cta-position="opportunities"]').first().getAttribute('href'));
  assert.equal(purchase.pathname,'/go/booth');
  assert.equal(purchase.searchParams.get('page'),'/opportunities/');
  assert.equal(purchase.searchParams.get('utm_campaign'),'lv27-suppliers');
  await page.goto('https://infused.show/?referrer_host=www.google.com',{waitUntil:'load'});
  const organic = new URL(await page.locator('a[data-cta-position="hero"]').getAttribute('href'));
  assert.equal(organic.searchParams.get('referrer_host'),'www.google.com');
  await page.goto('https://infused.show/?utm_campaign=name%40example.invalid',{waitUntil:'load'});
  const invalid = new URL(await page.locator('a[data-cta-position="hero"]').getAttribute('href'));
  assert.equal(invalid.searchParams.has('utm_campaign'),false);
  const storage = await page.evaluate(() => ({
    cookies:document.cookie,
    local:localStorage.length,
    session:sessionStorage.length
  }));
  assert.deepEqual(storage,{cookies:'',local:0,session:0});
  console.log('PASS: tagged email landing, first-party CTA handoff, internal-page UTM propagation, organic-search origin, unsafe-token rejection, and cookie-free behavior.');
} finally {
  await browser.close();
}
