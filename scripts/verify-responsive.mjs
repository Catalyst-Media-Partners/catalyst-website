import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const widths = [320, 375, 414, 520, 768, 780, 781, 960, 1060, 1120, 1121, 1280, 1440, 1600, 1920, 2048, 2560];
const routes = [
  {path: '', inspectHero: true},
  {path: 'opportunities', inspectHero: false},
  {path: 'contact', inspectHero: false}
];

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
let checked = 0;
try {
  const page = await browser.newPage({ viewport: {width: 1280, height: 1000}, deviceScaleFactor: 1 });
  for (const route of routes) {
    const url = pathToFileURL(path.join(root, 'public', route.path, 'index.html')).href;
    await page.goto(url, { waitUntil: 'load' });
    for (const width of widths) {
      await page.setViewportSize({width, height: 1000});
      const layout = await page.evaluate(() => {
        const rect = (node) => {
          if (!node) return null;
          const r = node.getBoundingClientRect();
          return {left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height};
        };
        const hero = document.querySelector('.hero');
        const copy = document.querySelector('.hero-copy');
        const image = document.querySelector('.hero-image');
        const content = copy ? [
          ...copy.children,
          ...copy.querySelectorAll('h1 span, .hero-buttons .btn, .hero-event-date strong, .hero-event-date span')
        ].map(el => ({name: el.tagName.toLowerCase() + (el.className ? '.' + el.className : ''), rect: rect(el)})) : [];
        return {
          viewport: window.innerWidth,
          documentWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          hero: rect(hero), copy: rect(copy), image: rect(image),
          content
        };
      });
      const context = route.path || 'home';
      assert.equal(layout.viewport, width, context + ': unexpected viewport');
      assert.ok(layout.documentWidth <= width + 1,
        context + ' at ' + width + 'px: horizontal document overflow (' + layout.documentWidth + 'px)');
      if (route.inspectHero) {
        assert.ok(layout.hero && layout.copy && layout.image, 'Homepage hero is missing');
        const sideBySide = width > 1120;
        if (sideBySide) {
          assert.ok(layout.copy.right <= layout.image.left + 1,
            context + ' at ' + width + 'px: hero grid columns overlap');
        } else {
          assert.ok(layout.copy.bottom <= layout.image.top + 1,
            context + ' at ' + width + 'px: stacked hero rows overlap');
        }
        for (const item of layout.content) {
          const bounds = item.rect;
          assert.ok(bounds.left >= layout.hero.left - 1,
            context + ' at ' + width + 'px: content escapes left boundary: ' + item.name);
          assert.ok(bounds.right <= layout.hero.right + 1,
            context + ' at ' + width + 'px: content escapes right boundary: ' + item.name);
          if (sideBySide) {
            assert.ok(bounds.right <= layout.image.left + 1,
              context + ' at ' + width + 'px: copy covers image: ' + item.name + ', right=' + bounds.right + ', image left=' + layout.image.left);
          } else {
            assert.ok(bounds.bottom <= layout.image.top + 1,
              context + ' at ' + width + 'px: copy covers stacked image: ' + item.name);
          }
        }
      }
      checked++;
    }
  }
  console.log('PASS: ' + checked + ' responsive Chromium viewport checks across homepage, opportunities and contact (320px to 2560px).');
} finally {
  await browser.close();
}
