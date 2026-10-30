#!/usr/bin/env python3
"""Responsive and interaction QA for preview and root-path INFUSED Drop Journey builds."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import os, re, base64, json, sys
ROOT=Path(__file__).resolve().parents[1]
MODE=os.environ.get('INFUSED_MODE','preview')
if MODE not in ('preview','production'):raise RuntimeError('INFUSED_MODE must be preview or production')
BASE='/' if MODE=='production' else '/dropjourneytest/'
DIST=ROOT/'dist'/('production' if MODE=='production' else 'dropjourneytest')
OUT=ROOT/'screenshots'/MODE
OUT.mkdir(parents=True,exist_ok=True)
css=(DIST/'assets/site.css').read_text()
js=(DIST/'assets/site.js').read_text()
intake_js=(DIST/'assets/intake.js').read_text()
ticket_js=(DIST/'assets/ticket-notify.js').read_text()
lookup={}
def media(link):
    p=link.split('?')[0]
    if p.startswith(BASE):p=p[len(BASE):]
    p=p.lstrip('/')
    file=DIST/p
    if not file.exists():raise RuntimeError('Missing image: '+link+' -> '+str(file))
    if str(file) not in lookup:
        ext=file.suffix.lower().lstrip('.')
        lookup[str(file)]='data:image/'+('jpeg' if ext=='jpg' else ext)+';base64,'+base64.b64encode(file.read_bytes()).decode()
    return lookup[str(file)]
def prepare(route):
    markup=(DIST/route/'index.html').read_text()
    if route=='':
        markup=re.sub(r'url\([\'"]((?:/dropjourneytest/)?assets/images/[^\'"\)]+)[\'"]\)',lambda m:'url("'+media(m[1])+'")',markup)
    else:
        markup=markup.replace('<link rel="stylesheet" href="'+BASE+'assets/site.css">','<style>'+css+'</style>')
        markup=markup.replace('<script src="'+BASE+'assets/site.js" defer></script>','')
        markup=markup.replace('<script src="'+BASE+'assets/intake.js" defer></script>','')
        markup=markup.replace('<script src="'+BASE+'assets/ticket-notify.js" defer></script>','')
        extra='<script>'+js+'</script><script>'+intake_js+'</script>'
        if route=='tickets':extra+='<script>'+ticket_js+'</script>'
        markup=markup.replace('</body>',extra+'</body>')
    markup=re.sub(r'src="((?:/dropjourneytest/)?assets/images/[^"#?]+)"',lambda m:'src="'+media(m[1])+'"',markup)
    return markup
cases=[
 ('',1440,900),('',1024,768),('',768,900),('',390,844),
 ('market',1440,900),('market',390,844),
 ('ecosystem',1024,768),('ecosystem',390,844),
 ('roots',1440,900),('roots',390,844),
 ('science',768,900),('science',390,844),
 ('make',1024,768),('package',390,844),
 ('move',768,900),('sell',390,844),
 ('services',1024,768),('buyers',390,844),
 ('why-vegas',1440,900),('opportunities',390,844),
 ('buyers/apply',1440,900),('buyers/apply',390,844),
 ('tickets',1024,768),('tickets',390,844),
 ('contact',768,900),('contact',390,844)
]
records=[]
with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,args=['--no-sandbox','--disable-gpu'])
  for route,width,height in cases:
    page=browser.new_page(viewport={'width':width,'height':height},device_scale_factor=1,reduced_motion='reduce')
    page.route('https://challenges.cloudflare.com/**',lambda route:route.abort())
    page.add_init_script("""window.fetch = async () => new Response(JSON.stringify({enabled:false}), {status:200,headers:{'Content-Type':'application/json'}});""")
    errors=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content(prepare(route),wait_until='load',timeout=35000)
    page.wait_for_timeout(120)
    overflow=page.evaluate('document.documentElement.scrollWidth > innerWidth + 2')
    broken=page.evaluate('''[...document.images].filter(img => {const r=img.getBoundingClientRect();return r.width>0 && r.height>0 && r.top < innerHeight+200 && r.bottom >= -200 && (!img.complete || !img.naturalWidth)}).length''')
    h1=page.locator('h1').count()
    if route=='':
        page.locator('#enter-drop').click(force=True)
        page.wait_for_timeout(900)
        page.locator('[data-go="who"]').click(force=True)
        page.wait_for_timeout(900)
        if page.locator('body').get_attribute('data-stage')!='who':errors.append('cannot navigate to WHO chapter')
    else:
        page.locator('.dj-explore').click()
        if page.locator('#dj-drawer').is_hidden():errors.append('menu failed to open')
        page.keyboard.press('Escape')
        if not page.locator('#dj-drawer').is_hidden():errors.append('menu failed Escape close')
        target=page.locator('.dj-explore').bounding_box()
        if not target or target['width']<44 or target['height']<44:errors.append('explore tap target below 44px')
        if route in ('buyers/apply','contact'):
            form=page.locator('form.dj-intake-form')
            if form.count()!=1:errors.append('native intake form missing')
            elif form.get_attribute('action')!=BASE+'api/intake':errors.append('native intake action has wrong base')
            if not page.locator('input[name="consent_contact"]').count():errors.append('required inquiry consent missing')
        if route=='tickets':
            form=page.locator('form.dj-ticket-notify-form')
            if form.count()!=1:errors.append('ticket notice form missing')
            elif form.get_attribute('action')!=BASE+'tickets/api/subscribe':errors.append('ticket notice action has wrong base')
    path=OUT/((route.replace('/','-') or 'journey')+'-'+str(width)+'.png')
    page.screenshot(path=str(path),full_page=False,animations='disabled')
    rec={'route':route or '/','width':width,'h1':h1,'overflow':overflow,'broken_images':broken,'errors':errors,'screenshot':path.name}
    records.append(rec)
    print(('PASS' if not any([overflow,broken,errors]) and h1==1 else 'FAIL'),rec)
    page.close()
  browser.close()
(OUT/'visual_qa.json').write_text(json.dumps(records,indent=2))
if any(x['overflow'] or x['broken_images'] or x['errors'] or x['h1']!=1 for x in records):sys.exit(1)
print('PASS all visual/interaction cases:',len(records),'mode:',MODE)
