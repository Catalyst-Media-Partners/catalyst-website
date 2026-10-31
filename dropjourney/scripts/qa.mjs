import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(new URL('..',import.meta.url).pathname);
const mode=process.env.INFUSED_MODE||'preview';
assert.ok(['preview','production'].includes(mode),'INFUSED_MODE must be preview or production');
const base=mode==='production'?'/':'/dropjourneytest/';
const indexable=mode==='production';
const dist=path.join(root,'dist',indexable?'production':'dropjourneytest');
const ids=['','market','ecosystem','roots','science','make','package','move','sell','services','buyers','why-vegas','opportunities','contact','tickets','buyers/apply'];
let pages=0,links=0,images=0;
for(const id of ids){
 const file=path.join(dist,id,'index.html');
 const html=await readFile(file,'utf8');const label=id||'journey';
 if(indexable){
  assert.match(html,/<meta name="robots" content="index, follow">/i,label+' should be indexable');
  const route=id?'/'+id+'/' : '/';
  assert.ok(html.includes('<link rel="canonical" href="https://infused.show'+route+'">'),label+': canonical must point to the root domain');
  assert.ok(!html.includes('/dropjourneytest/'),label+': preview path leaked into production output');
 }else{
  assert.match(html,/<meta name="robots" content="noindex[, ]*nofollow[, ]*noarchive"/i,label+' should be noindex');
  assert.ok(!html.includes('<link rel="canonical" href="https://infused.show/'),label+': preview must not declare a production canonical');
 }
 assert.match(html,/<main\b/i,label+' missing main');
 const h1=(html.match(/<h1\b/g)||[]).length;assert.equal(h1,1,label+': exactly one h1');
 assert.ok(!html.includes('AN INTERACTIVE PREVIEW'),label+': prototype disclaimer in public copy');
 assert.ok(!/jotform/i.test(html),label+': no Jotform dependency allowed');
 if(id==='tickets'){
  assert.match(html,/class="dj-ticket-notify-form"/,label+': ticket notification UI remains present but disabled');
  assert.ok(html.includes('id="ticket-notify-form"'),'email-only ticket flow required');
  assert.ok(html.includes('not yet on sale'),'honest ticket-not-on-sale state');
  assert.ok(html.includes('action="'+base+'tickets/api/subscribe"'),'ticket action must use the selected base');
  assert.ok(html.includes(base+'assets/ticket-notify.js'),'ticket script must use the selected base');
 }else if(['buyers/apply','contact'].includes(id)){
  assert.match(html,/class="dj-intake-form"/,label+': required native inquiry form missing');
  assert.ok(html.includes('action="'+base+'api/intake"'),'intake action must use the selected base');
 }else assert.ok(!html.includes('<form'),label+': unexpected form');
 for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){
  const u=m[1];
  if(u.startsWith(base+'assets/')){
   const target=path.join(dist,u.slice(base.length));await stat(target).catch(()=>{throw Error(label+': missing resource '+u)});links++;
  }else if(u.startsWith('assets/')){
   const target=path.join(dist,u);await stat(target).catch(()=>{throw Error(label+': missing relative resource '+u)});links++;
  }
 }
 for(const m of html.matchAll(/src="(?:\/)?(?:dropjourneytest\/)?assets\/images\/([^"?#]+\.webp)/g)){
  const target=path.join(dist,'assets','images',m[1]);await stat(target);images++;
 }
 pages++;
}
const robots=await readFile(path.join(dist,'robots.txt'),'utf8');
if(indexable){
 assert.ok(robots.includes('Allow: /'));
 assert.ok(robots.includes('Sitemap: https://infused.show/sitemap.xml'));
 const sitemap=await readFile(path.join(dist,'sitemap.xml'),'utf8');
 assert.equal((sitemap.match(/<url>/g)||[]).length,16,'production sitemap should list the 16 published site routes');
 assert.ok(sitemap.includes('https://infused.show/buyers/apply/'));
}else{
 assert.ok(robots.includes('Disallow: /'));
 await assert.rejects(()=>readFile(path.join(dist,'sitemap.xml'),'utf8'));
}
const code=await readFile(path.join(root,'worker.mjs'),'utf8');
for(const needle of ['SITE_BASE_PATH','SITE_ALLOWED_HOSTS','SITE_MODE','BOOTH_ATTRIBUTION','intakePath(env)','ticketPrefix(env)','noindex, nofollow, noarchive','env.ASSETS.fetch','X-DropJourney-Version'])assert.ok(code.includes(needle),'Worker missing '+needle);
assert.ok(!code.includes('AUDIENCE_DB'),'Dark Worker must not duplicate the production audience binding');
const previewConfig=await readFile(path.join(root,'wrangler.toml'),'utf8');
assert.ok(previewConfig.includes('name = "infused-dropjourneytest"'),'Existing preview Worker identity must remain unchanged');
assert.ok(previewConfig.includes('workers_dev = false'),'No workers.dev public preview');
assert.ok(previewConfig.includes('TICKET_NOTIFY_ENABLED = "false"'),'Ticket notifications must remain disabled');
const canaryTemplate=await readFile(path.join(root,'wrangler.dark-canary.template.toml'),'utf8');
for(const needle of ['name = "infused-dark"','SITE_BASE_PATH = "/"','SITE_MODE = "canary"','SITE_ALLOWED_HOSTS = "dark.infused.show"','INTAKE_ENVIRONMENT = "preview"','TICKET_NOTIFY_ENABLED = "false"','binding = "BOOTH_ATTRIBUTION"','database_id = "13188d57-a463-445d-b341-9479ac3a4558"'])assert.ok(canaryTemplate.includes(needle),'Dark canary template missing '+needle);
const productionTemplate=await readFile(path.join(root,'wrangler.dark-production.template.toml'),'utf8');
for(const needle of ['name = "infused-dark"','SITE_MODE = "production"','SITE_ALLOWED_HOSTS = "infused.show,dark.infused.show,www.infused.show"','INTAKE_ENVIRONMENT = "production"','INTAKE_TEST_MODE = "false"','database_id = "2082f84e-bacd-4ef2-8902-265eda67e4d1"','TICKET_NOTIFY_ENABLED = "false"'])assert.ok(productionTemplate.includes(needle),'Dark production template missing '+needle);
const productionAcceptanceTemplate=await readFile(path.join(root,'wrangler.dark-production-acceptance.template.toml'),'utf8');
for(const needle of ['SITE_MODE = "canary"','SITE_ALLOWED_HOSTS = "dark.infused.show"','INTAKE_ENVIRONMENT = "production"','INTAKE_TEST_MODE = "true"','database_id = "2082f84e-bacd-4ef2-8902-265eda67e4d1"','TICKET_NOTIFY_ENABLED = "false"'])assert.ok(productionAcceptanceTemplate.includes(needle),'Dark production acceptance template missing '+needle);
assert.equal((await readdir(path.join(dist,'assets','images'))).filter(x=>x.endsWith('.webp')).length,21,'expected 21 optimized source images');
if(indexable){
 const campaign=JSON.parse(await readFile(path.join(root,'content/landers.json'),'utf8'));
 for(const offer of campaign.variants){
  const html=await readFile(path.join(dist,'land',offer.id,'index.html'),'utf8');
  assert.ok(!html.includes('/dropjourneytest/'),'Campaign '+offer.id+': preview path leaked into production output');
  assert.ok(html.includes('<meta name="infused-base" content="/">'),'Campaign '+offer.id+': root base metadata missing');
  assert.ok(html.includes('https://infused.show'+offer.destination.replace('/dropjourneytest/','/')),'Campaign '+offer.id+': primary destination not mapped to production');
  assert.ok(html.includes('https://infused.show'+offer.secondaryDestination.replace('/dropjourneytest/','/')),'Campaign '+offer.id+': secondary destination not mapped to production');
  assert.match(html,/noindex, nofollow, noarchive/,'Campaign '+offer.id+': standalone lander must remain noindex');
 }
 const siteJs=await readFile(path.join(root,'src/site.js'),'utf8');
 assert.ok(siteJs.includes('meta[name="infused-base"]'),'Production navigation must read the selected site base');
}
console.log('PASS INFUSED '+mode+' build: '+pages+' routes, 21 optimized images, '+links+' asset links, '+images+' image references, '+(indexable?'canonical/indexable root metadata':'noindex preview metadata')+', ticket notifications remain disabled');
