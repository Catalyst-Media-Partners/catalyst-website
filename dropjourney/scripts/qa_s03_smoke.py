#!/usr/bin/env python3
"""Fast S03 DOM/layout QA using generated HTML with inlined local assets."""
from pathlib import Path
import json,re,sys
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
dist=root/'dist'/'dropjourneytest'; css=(dist/'assets/site.css').read_text();js=(dist/'assets/site.js').read_text()
out=root/'screenshots_s03';out.mkdir(exist_ok=True)
transparent='data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='
def prepare(route):
 s=(dist/route/'index.html').read_text()
 if route:
  s=s.replace('<link rel="stylesheet" href="/dropjourneytest/assets/site.css">','<style>'+css+'</style>')
  s=s.replace('<script src="/dropjourneytest/assets/site.js" defer></script>','').replace('</body>','<script>'+js+'</script></body>')
 s=re.sub('src="/dropjourneytest/assets/images/[^"?#]+"','src="'+transparent+'"',s)
 s=re.sub(r'url\([\'\"]?/dropjourneytest/assets/images/[^\)]+\)', 'none',s)
 return s
checks=[('',w) for w in [320,360,390,768,1024,1440]]
for route in ['market','ecosystem','opportunities','buyers','buyers/apply']:
 checks +=[(route,w) for w in [320,360,390,768,1024,1440]]
for route in ['roots','science','make','package','move','sell','services','why-vegas','contact','tickets']:
 checks += [(route,390),(route,1440)]
records=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for w in [320,360,390,768,1024,1440]:
  pg=b.new_page(viewport={'width':w,'height':844 if w<768 else 900})
  errs=[];pg.on('pageerror',lambda e:errs.append(str(e)))
  for route,width in [pair for pair in checks if pair[1]==w]:
   pg.set_content(prepare(route),wait_until='domcontentloaded',timeout=20000)
   if not route:
    pg.locator('#enter-drop').click(force=True);pg.wait_for_timeout(1040)
   m=pg.evaluate('''() => {
const rect=e=>e.getBoundingClientRect(),elements=q=>[...document.querySelectorAll(q)].filter(e=>getComputedStyle(e).display!=='none'&&rect(e).width>0), tiles=elements('.market-scroll .market-point').map(rect);
const overlaps=tiles.some((a,i)=>tiles.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3));
const h=document.documentElement;
const overflow=elements('.market-scroll,.chapter-nav,.dj-source-section .stats-grid').map(e=>({name:e.className,width:e.clientWidth,scroll:e.scrollWidth})).filter(x=>x.scroll>x.width+2);
const offscreen=elements('.market-point,.chapter-nav button,.dj-source-section .stat,.dj-header-actions').filter(e=>rect(e).right>innerWidth+3||rect(e).left< -3).map(e=>e.className);
return {doc:h.scrollWidth-innerWidth,tiles:tiles.length,overlaps,overflow,offscreen,forms:document.forms.length,version:document.querySelector('meta[name=dropjourney-site-version]')?.content};}''')
   e=[]
   if m['doc']>2 or m['overlaps'] or m['overflow'] or m['offscreen']:e.append('layout '+str(m))
   if not route and (pg.locator('#motion-optin').count() or m['forms']):e.append('activation button/native form')
   records.append({'route':route or '/', 'width':w,'result':m,'errors':e})
   if e:print('FAIL',records[-1],flush=True)
   if not route and w in [320,390,768,1440]:pg.screenshot(path=str(out/f'why-{w}.png'),animations='disabled')
   if route=='market' and w in [320,390,768,1440]:pg.screenshot(path=str(out/f'market-{w}.png'),animations='disabled')
  pg.close()
 # Canvas smoke for user reported regression.
 for route in ['','market']:
  pg=b.new_page(viewport={'width':1024,'height':768})
  water_errors=[];pg.on('pageerror',lambda error:water_errors.append(str(error)))
  pg.set_content(prepare(route),wait_until='domcontentloaded')
  if not route:
   pg.locator('#enter-drop').click(force=True);pg.wait_for_timeout(1050)
  pg.mouse.move(110,320);pg.mouse.move(380,320,steps=13);pg.wait_for_timeout(85)
  m=pg.evaluate('''()=>{const c=document.querySelector('#liquid-canvas,.dj-water'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let a=0,b=0;for(let i=3;i<d.length;i+=4){if(d[i]>4)a++;if(d[i]>14)b++;}return {a,b,visibility:getComputedStyle(c).visibility};}''')
  pg.mouse.click(380,320);pg.wait_for_timeout(130)
  n=pg.evaluate('''()=>{const c=document.querySelector('#liquid-canvas,.dj-water'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>14)n++;return n;}''')
  records.append({'route':route or '/','water':{'hover':m,'click':n},'errors':([*water_errors] if water_errors else [])+([] if m['a']>25 and n>25 else ['water not visibly painted'])})
  pg.close()
 for route in ['','market']:
  pg=b.new_page(viewport={'width':390,'height':844},java_script_enabled=False)
  pg.set_content(prepare(route),wait_until='domcontentloaded')
  count=pg.locator('.dj-nojs a').count()
  records.append({'route':route or '/','noJS_nav_links':count,'errors':[] if count>=8 else ['no-JS routes missing']});pg.close()
 b.close()
(out/'smoke.json').write_text(json.dumps(records,indent=2))
fail=[r for r in records if r['errors']];print('S03 smoke checks:',len(records),'failed:',len(fail),flush=True)
for r in records[-4:]:print(r)
if fail:sys.exit(1)
