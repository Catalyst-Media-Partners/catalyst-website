#!/usr/bin/env python3
"""Render generated pages in Chromium using set_content (localhost navigation is blocked here)."""
from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import re, base64, json, sys
ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'/'dropjourneytest'
OUT=ROOT/'screenshots'
OUT.mkdir(exist_ok=True)
css=(DIST/'assets/site.css').read_text()
js=(DIST/'assets/site.js').read_text()
lookup={}
def media(link):
    p=link.split('/dropjourneytest/')[-1].split('?')[0]
    file=DIST/p
    if not file.exists():raise RuntimeError(f'Missing image: {link} -> {file}')
    if str(file) not in lookup:
        ext=file.suffix.lower().lstrip('.')
        lookup[str(file)]='data:image/'+('jpeg' if ext=='jpg' else ext)+';base64,'+base64.b64encode(file.read_bytes()).decode()
    return lookup[str(file)]
def prepare(route):
    markup=(DIST/route/'index.html').read_text()
    if route=='':
        # v1.5 embeds its own CSS and JS; only image URLs in S02 overrides need translation
        markup=re.sub(r'url\([\'"](\/dropjourneytest\/assets\/images\/[^\'"\)]+)[\'"]\)',lambda m:'url("'+media(m[1])+'")',markup)
    else:
        markup=markup.replace('<link rel="stylesheet" href="/dropjourneytest/assets/site.css">','<style>'+css+'</style>')
        markup=markup.replace('<script src="/dropjourneytest/assets/site.js" defer></script>','')
        markup=markup.replace('</body>','<script>'+js+'</script></body>')
    markup=re.sub(r'src="(\/dropjourneytest\/assets\/images\/[^"#?]+)"',lambda m:'src="'+media(m[1])+'"',markup)
    return markup
cases=[('',1440,900),('',390,844),('market',1440,900),('market',390,844),('ecosystem',1440,900),('ecosystem',390,844),('roots',1024,768),('roots',390,844),('buyers',1440,900),('buyers',390,844),('buyers/apply',1440,900),('buyers/apply',390,844),('opportunities',1440,900),('opportunities',390,844),('tickets',390,844),('contact',768,900)]
records=[]
with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-gpu'])
  for route,width,height in cases:
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1)
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(prepare(route),wait_until='load',timeout=35000)
    page.wait_for_timeout(140)
    overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 2')
    broken=page.evaluate('''[...document.images].filter(img => {const r=img.getBoundingClientRect();return r.width>0 && r.height>0 && r.top < innerHeight+200 && r.bottom >= -200 && (!img.complete || !img.naturalWidth)}).length''')
    h1=page.locator('h1').count()
    if route=='':
        page.locator('#enter-drop').click(force=True)
        page.wait_for_timeout(1100)
        stage=page.locator('body').get_attribute('data-stage')
        page.locator('[data-go="who"]').click(force=True)
        page.wait_for_timeout(1100)
        if page.locator('body').get_attribute('data-stage')!='who':errors.append('cannot navigate to WHO chapter')
    else:
        page.locator('.dj-explore').click()
        if page.locator('#dj-drawer').is_hidden():errors.append('menu failed to open')
        page.keyboard.press('Escape')
        if not page.locator('#dj-drawer').is_hidden():errors.append('menu failed Escape close')
        if route=='buyers/apply':
            page.locator('input[name="buyer_role"]').first.check()
            page.locator('input[name="buyer_confirm"]').check()
            page.locator('#buyer-forward').click()
            if page.locator('.buyer-step:not([hidden])').get_attribute('data-bstep')!='1':errors.append('buyer wizard step 1 failed')
    path=OUT/((route.replace('/','-') or 'journey')+f'-{width}.png')
    page.screenshot(path=str(path),full_page=False,animations='disabled')
    rec={'route':route or '/','width':width,'h1':h1,'overflow':overflow,'broken_images':broken,'errors':errors,'screenshot':path.name}
    records.append(rec)
    print(('PASS' if not any([overflow,broken,errors]) else 'FAIL'),rec)
    page.close()
  browser.close()
(OUT/'visual_qa.json').write_text(json.dumps(records,indent=2))
if any(x['overflow'] or x['broken_images'] or x['errors'] or x['h1']!=1 for x in records):sys.exit(1)
print('PASS all visual/interaction cases:',len(records))
