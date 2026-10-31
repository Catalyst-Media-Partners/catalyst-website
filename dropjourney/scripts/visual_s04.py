#!/usr/bin/env python3
"""S04 local Chromium acceptance, using fully inlined static source assets."""
from pathlib import Path
from playwright.sync_api import sync_playwright
import re,base64,json
root=Path(__file__).resolve().parents[1]
dist=root/'dist'/'dropjourneytest'
css=(dist/'assets/site.css').read_text();js=(dist/'assets/site.js').read_text()
out=root/'screenshots_s04';out.mkdir(exist_ok=True)
imgs=dist/'assets/images'
errors=[];results=[]
transparent='data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='
def data_uri(p):
  if not p.exists():return transparent
  ext='webp' if p.suffix=='.webp' else 'png'
  return f'data:image/{ext};base64,'+base64.b64encode(p.read_bytes()).decode()
def prepare(route):
  s=(dist/route/'index.html').read_text()
  if route:
    s=s.replace('<link rel="stylesheet" href="/dropjourneytest/assets/site.css">','<style>'+css+'</style>')
    s=s.replace('<script src="/dropjourneytest/assets/site.js" defer></script>','').replace('</body>','<script>'+js+'</script></body>')
    s=re.sub(r'src="/dropjourneytest/assets/images/([^"?#]+)"',lambda m:'src="'+data_uri(imgs/m[1])+'"',s)
  s=re.sub(r'url\([\'\"]?/dropjourneytest/assets/images/([^\)\'\"]+)[\'\"]?\)', 'none', s)
  s=re.sub(r'src="/dropjourneytest/assets/images/[^"]+"','src="'+transparent+'"',s)
  return s
with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  for w in [320,360,390,768,1024,1440]:
    page=browser.new_page(viewport={'width':w,'height':844 if w<768 else 900},reduced_motion='reduce')
    page_errors=[];page.on('pageerror',lambda x:page_errors.append(str(x)))
    page.set_content(prepare(''),wait_until='domcontentloaded')
    intro=page.evaluate('''() => ({v:document.querySelector('meta[name=dropjourney-site-version]')?.content,svg:document.querySelectorAll('.drop-svg').length,overflow:document.documentElement.scrollWidth-innerWidth})''')
    if intro['v']!='2.2.0-s04' or intro['svg']!=2 or intro['overflow']>2:errors.append(('intro',w,intro))
    page.locator('#enter-drop').click(force=True);page.wait_for_timeout(25)
    for name in ['why','who','when','where','what']:
      if name!='why':page.locator('[data-go="'+name+'"]').click(force=True);page.wait_for_timeout(25)
      stats=page.evaluate('''() => {const q=s=>[...document.querySelectorAll(s)].filter(e=>{const r=e.getBoundingClientRect();return getComputedStyle(e).display!=='none'&&r.width>0}),r=e=>e.getBoundingClientRect();const cards=q('.market-scroll .market-point'),boxes=cards.map(r);return {stage:document.body.dataset.stage,doc:document.documentElement.scrollWidth-innerWidth,internal:[...document.querySelectorAll('.market-scroll,.chapter-nav')].map(e=>e.scrollWidth-e.clientWidth),overlap:boxes.some((a,i)=>boxes.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)),offscreen:cards.filter(e=>r(e).right>innerWidth+3||r(e).left< -3).length,drop:document.querySelector('.drop-vector')?.getBoundingClientRect().width}}''')
      results.append({'width':w,'chapter':name,**stats})
      if stats['stage']!=name or stats['doc']>2 or any(x>2 for x in stats['internal']) or stats['overlap'] or stats['offscreen']>0 or stats['drop']<90: errors.append(('chapter',w,name,stats))
      if (w,name) in [(390,'why'),(1440,'why'),(390,'who'),(1440,'who')]:page.screenshot(path=str(out/f'{name}-{w}.png'),animations='disabled')
    if page_errors:errors.append(('page errors',w,page_errors))
    page.close()
  for route in ['market','ecosystem','why-vegas','opportunities']:
    page=browser.new_page(viewport={'width':390,'height':844})
    page.set_content(prepare(route),wait_until='domcontentloaded')
    detail=page.evaluate('''()=>({overflow:document.documentElement.scrollWidth-innerWidth,h1:document.querySelectorAll('h1').length,imgs:[...document.images].filter(i=>i.complete&&!i.naturalWidth).length})''')
    if detail['overflow']>2 or detail['h1']!=1 or detail['imgs']>0:errors.append(('detail',route,detail))
    results.append({'detail':route,**detail})
    page.close()
  # Normal-motion pointer interaction is tested separately from layout snapshots.
  pg=browser.new_page(viewport={'width':1024,'height':768})
  pg.set_content(prepare(''),wait_until='domcontentloaded')
  pg.locator('#enter-drop').click(force=True);pg.wait_for_timeout(1040)
  pg.mouse.move(140,300);pg.mouse.move(420,300,steps=16);pg.wait_for_timeout(100)
  wave=pg.evaluate('''() => {const c=document.querySelector('#liquid-canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4){if(d[i]>6)n++;}return n}''')
  if wave<10:errors.append(('water interaction',wave))
  pg.close()
  # Reduced motion suppresses Canvas, but content and navigation remain operable.
  page=browser.new_page(viewport={'width':390,'height':844},reduced_motion='reduce')
  page.set_content(prepare(''),wait_until='domcontentloaded')
  page.locator('#enter-drop').click(force=True);page.wait_for_timeout(100)
  reduced=page.evaluate('''()=>({stage:document.body.dataset.stage,canvas:getComputedStyle(document.querySelector('#liquid-canvas')).display})''')
  if reduced['stage']!='why' or reduced['canvas']!='none':errors.append(('reduced motion',reduced))
  page.close()
  browser.close()
(out/'acceptance.json').write_text(json.dumps({'results':results,'errors':errors},indent=2))
print('S04 visual checks:',len(results),'failures:',len(errors))
for e in errors[:12]:print('FAIL',e)
if errors:raise SystemExit(1)
