import {readFile, mkdir, readdir, copyFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderMarket,renderVegas} from './src/s05-pages.mjs';
import {renderEcosystem,renderSector,checkTaxonomy} from './src/s06-pages.mjs';

// Separate site, generated exclusively beneath /dropjourneytest/. No production build edits.
const root=path.dirname(fileURLToPath(import.meta.url));
const source=process.env.INFUSED_SRC?path.resolve(process.env.INFUSED_SRC):path.resolve(root,'../src');
const output=path.join(root,'dist','dropjourneytest');
const BASE='/dropjourneytest/';
const load=(rel)=>readFile(path.join(root,rel),'utf8');
const prod=(rel)=>readFile(path.join(source,rel),'utf8');
const esc=(s)=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const catalog=[
 {id:'market',label:'Market size',chapter:'WHY',num:'01',section:'market',photo:'product-research-and-laboratory-testing-02.webp',next:'ecosystem'},
 {id:'ecosystem',label:'The ecosystem',chapter:'WHO',num:'02',section:'ecosystem',photo:'trade-show-product-discovery-and-buyer-conversation-04.webp',next:'roots'},
 {id:'roots',label:'Roots',chapter:'WHO',num:'02',section:'roots',photo:'outdoor-farming-and-cultivation-05.webp',next:'science'},
 {id:'science',label:'Science',chapter:'WHO',num:'02',section:'science',photo:'ingredient-science-and-laboratory-research-06.webp',next:'make'},
 {id:'make',label:'Make',chapter:'WHO',num:'02',section:'make',photo:'manufacturing-and-co-packing-line-07.webp',next:'package'},
 {id:'package',label:'Package',chapter:'WHO',num:'02',section:'package',photo:'packaged-beverages-and-finished-products-08.webp',next:'move'},
 {id:'move',label:'Move',chapter:'WHO',num:'02',section:'move',photo:'warehouse-and-logistics-operations-09.webp',next:'sell'},
 {id:'sell',label:'Sell',chapter:'WHO',num:'02',section:'sell',photo:'retail-merchandising-of-infused-products-10.webp',next:'services'},
 {id:'services',label:'Business services',chapter:'WHO',num:'02',section:'services',photo:'business-professionals-in-discussion-11.webp',next:'buyers'},
 {id:'buyers',label:'Hosted buyers',chapter:'WHO',num:'02',section:'buyers',photo:'brand-representative-in-a-hosted-buyer-discussion-at-a-booth-18.webp',next:'why-vegas'},
 {id:'why-vegas',label:'Why Vegas',chapter:'WHERE',num:'04',section:'why-vegas',photo:'welcome-to-las-vegas-sign-and-las-vegas-skyline-19.webp',next:'opportunities'},
 {id:'opportunities',label:'Exhibit options',chapter:'WHAT',num:'05',section:'opportunities',photo:'infused-exhibitors-with-attendees-at-their-show-booth-20.webp',next:'contact'},
 {id:'contact',label:'Contact',chapter:'WHAT',num:'05',section:'contact',photo:'infused-exhibitors-with-attendees-at-their-show-booth-20.webp',next:'tickets'},
 {id:'tickets',label:'Tickets',chapter:'WHEN',num:'03',section:null,photo:'professionals-meeting-and-discovering-infused-product-brands-at-a--01.webp',next:'market'}
];
const categories=catalog.filter(x=>['roots','science','make','package','move','sell','services'].includes(x.id));
const taxonomy=Object.freeze(JSON.parse(await load('content/taxonomy.json')));
checkTaxonomy(taxonomy,catalog);
const href=id=>BASE+(id?id+'/':'');
const pathify=raw=>raw.replaceAll('{{BASE}}',BASE).replaceAll('href="/','href="'+BASE);
const imagesRoot=BASE+'assets/images/';
const css=(await load('src/site.css'))+'\n'+(await load('src/s05.css'))+'\n'+(await load('src/s06.css'));
const js=await load('src/site.js');
// Reuse the same approved transparent wordmark already in the deployed Drop Journey.
const originalHome=await load('src/index.html');
const event=Object.freeze(JSON.parse(await load('content/event.json')));
const dateParts=value=>{
  if(typeof value!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value))throw Error('DJ-S05 invalid event date format');
  const [year,month,day]=value.split('-').map(Number);
  const check=new Date(value+'T12:00:00Z');
  if(check.getUTCFullYear()!==year||check.getUTCMonth()!==month-1||check.getUTCDate()!==day)throw Error('DJ-S05 invalid calendar date');
  return {year,month,day,check};
};
const startDate=dateParts(event.startDate),endDate=dateParts(event.endDate);
const monthName=new Intl.DateTimeFormat('en-US',{month:'long',timeZone:'UTC'}).format(startDate.check);
if(startDate.year!==endDate.year||startDate.month!==endDate.month||startDate.day>endDate.day)throw Error('DJ-S05 date range differs');
const publishedDate=`${monthName} ${startDate.day}–${endDate.day}, ${startDate.year}`;
if(event.dateLabel!==publishedDate||!event.venue||!event.city||!event.verificationStatus)throw Error('DJ-S05 invalid event manifest');
const publishedOpportunities=await prod('sections/opportunities.html');
if(!originalHome.includes(event.dateLabel)||!originalHome.includes(event.venue)||!originalHome.includes(event.city)||!publishedOpportunities.includes(event.dateLabel)||!publishedOpportunities.includes(event.venue))throw Error('DJ-S05 source drift: production event fact mismatch');
const dropArtwork=await load('src/drop-art.svg');
function dropArt(variant){
  return dropArtwork.replaceAll('__DROP_ID__',variant).replaceAll('__DROP_CLASS__',variant==='intro'?'drop-hero-svg':'drop-vector');
}
const logo=originalHome.match(/<img class="hero-wordmark" src="(data:image\/png;base64,[^"]+)"/)?.[1]||imagesRoot+'infused-logo-00.webp';
const shop='https://infused.show/go/booth?position=navigation&amp;page=%2F';
function links(){return [
 ['opportunities','Exhibit / reserve a booth'],['tickets','Attend / tickets'],
 ['buyers','Hosted buyers'],['sponsor','Sponsor'],['contact','Contact the team'],
 ['market','Market opportunity'],['ecosystem','The ecosystem'],['why-vegas','Why Vegas']
 ];}
const menuHref=id=>id==='sponsor'?href('opportunities')+'#sponsorship':href(id);
function noScriptNav(){return `<noscript><nav class="dj-nojs" aria-label="Explore INFUSED without JavaScript"><p>Explore INFUSED</p><a href="${BASE}#why">Why INFUSED</a><a href="${BASE}#who">Who attends</a><a href="${BASE}#when">When</a><a href="${BASE}#where">Where</a><a href="${BASE}#what">What to do</a>${links().map(([key,label])=>`<a href="${menuHref(key)}">${esc(label)}</a>`).join('')}</nav></noscript>`;}
function head(title,description){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="theme-color" content="#100e17"><meta name="description" content="${esc(description)}"><meta name="dropjourney-site-version" content="2.3.0-s05"><title>${esc(title)} | INFUSED Las Vegas</title><link rel="stylesheet" href="${BASE}assets/site.css"><script src="${BASE}assets/site.js" defer></script></head>`;}
function header(id){return `<a class="dj-skip" href="#main">Skip to content</a><header class="dj-header" id="top"><a class="dj-logo" href="${BASE}" aria-label="INFUSED journey home"><img src="${logo}" alt="INFUSED" width="535" height="146"></a><div class="dj-header-actions"><button type="button" class="dj-explore" aria-expanded="false" aria-controls="dj-drawer"><span class="dj-menu-mark" aria-hidden="true"><i></i><i></i></span>Explore</button><a class="dj-top-action" href="${shop}">Reserve a booth <span aria-hidden="true">↗</span></a></div><nav id="dj-drawer" class="dj-drawer" aria-label="Explore INFUSED" hidden><span class="dj-menu-eyebrow">Discover your way through INFUSED</span><a href="${BASE}" class="dj-menu-home">The journey <span aria-hidden="true">↗</span></a>${links().map(([key,label])=>`<a href="${menuHref(key)}" ${key===id?'aria-current="page"':''}>${esc(label)} <span aria-hidden="true">↗</span></a>`).join('')}<div class="dj-drawer-foot"><span>FROM ROOTS TO RETAIL</span><span>LAS VEGAS ${startDate.year}</span></div></nav></header>`;}
function footer(){return `<footer class="dj-footer"><div><a href="${BASE}" class="dj-footer-logo"><img src="${logo}" alt="INFUSED" width="535" height="146"></a><p>The national business event for the entire infused-products ecosystem.</p></div><div class="dj-footer-links"><a href="${href('ecosystem')}">Ecosystem</a><a href="${href('opportunities')}">Exhibit</a><a href="${href('buyers')}">Hosted buyers</a><a href="${href('tickets')}">Tickets</a><a href="${href('contact')}">Contact</a></div><p class="dj-footer-date">${esc(event.dateLabel)}<br>${esc(event.venue)}</p></footer>`;}
function introNav(route){return `<div class="dj-wayfinder"><a href="${BASE}#${route.chapter.toLowerCase()}" class="dj-back">← ${route.chapter.toLowerCase()} / The journey</a><div class="dj-current"><span>${route.num}</span> / ${route.chapter} <span class="dj-wayline"></span> ${esc(route.label)}</div><a class="dj-inline-nav" href="${href(route.next)}">Explore next <span aria-hidden="true">↗</span></a></div>`;}
function convertSourceMarkup(html,id){
 const updated=html.replaceAll('{{BASE}}',BASE)
  .replace(/<h2\b/,'<h1').replace(/<\/h2>/,'</h1>')
  .replace(/href="https:\/\/shows\.map-dynamics\.com\/infusedlv2027\/\?register"/g,`href="https://infused.show/go/booth?position=${id==='opportunities'?'opportunities':'contact'}&amp;page=%2F${id}%2F"`)
  .replaceAll('—',':');
 if(id==='opportunities'){
  const exp=/<p class="booking-prompt-date">[^<]*<\/p>/;
  if(!exp.test(updated))throw Error('DJ-S05 original opportunity date not found');
  return updated.replace(exp,`<p class="booking-prompt-date">${esc(event.dateLabel)} · ${esc(event.venue)}</p>`);
 }
 return updated;
}
function originalImageAlt(route){return {'market':'Product research and laboratory testing','ecosystem':'Trade show product discovery and buyer conversations','roots':'Outdoor farming and cultivation','science':'Ingredient science and laboratory research','make':'Manufacturing and co-packing line','package':'Finished products and packaging','move':'Warehouse and logistics','sell':'Retail merchandising','services':'Business professionals meeting','buyers':'Buyer and brand representative in discussion','why-vegas':'Las Vegas skyline','opportunities':'Expo booth and product conversation','contact':'Exhibitors at a trade show','tickets':'Professionals in an expo conversation'}[route.id];}
function related(route){return `<aside class="dj-related" aria-label="Continue exploring"><span class="dj-kicker">FOLLOW THE CURRENT</span><h2>Continue the journey.</h2><div class="dj-related-row"><a href="${href(route.next)}"><span>${esc(catalog.find(x=>x.id===route.next)?.label||'The ecosystem')}</span><span aria-hidden="true">↗</span></a><a href="${href('opportunities')}"><span>Explore exhibit options</span><span aria-hidden="true">↗</span></a>${route.id!=='buyers'?`<a href="${href('buyers')}"><span>Discover hosted buyers</span><span aria-hidden="true">↗</span></a>`:`<a href="${href('buyers/apply')}"><span>Start buyer profile</span><span aria-hidden="true">↗</span></a>`}</div></aside>`;}
function photo(route){return `<div class="dj-editorial-frame"><img src="${imagesRoot}${route.photo}" alt="${esc(originalImageAlt(route))}" width="1450" height="960" decoding="async" loading="lazy"><div class="dj-frame-edge" aria-hidden="true"></div></div>`;}
async function detailPage(route){
 let content;
 if(route.id==='tickets'){
   content=await prod('tickets/index.html');
   content=content.replaceAll('{{BASE}}',BASE)
     .replace(/<form class="notify-form"[\s\S]*?<\/form>/, '<div class="dj-ticket-pending" role="status"><p>Ticket notifications are not accepting requests yet.</p><a class="btn btn-secondary" href="'+href('contact')+'">Questions? Contact the INFUSED Team ↗</a></div>')
     .replaceAll('—',':');
 }else{content=convertSourceMarkup(await prod(`sections/${route.section}.html`),route.id);}
 if(route.id==='market')content=renderMarket(content,{href});
 if(route.id==='why-vegas')content=renderVegas(content,{href,event});
 if(route.id==='ecosystem')content=renderEcosystem(content,{href,taxonomy});
 if(['roots','science','make','package','move','sell','services'].includes(route.id))content=renderSector(content,route,{href,taxonomy});
 if(route.id==='opportunities') content=content.replace('<article class="detail-box green"><h3>Sponsorship</h3>','<article class="detail-box green" id="sponsorship"><h3>Sponsorship</h3>');
 if(route.id==='buyers') content=content.replace('</section>',`<div class="dj-convert-inline"><span class="dj-kicker">FOR QUALIFIED BUYERS</span><p>Tell us what you need to source, using a guided buyer profile.</p><a href="${href('buyers/apply')}" class="dj-btn dj-btn-acid">Explore the buyer profile <span aria-hidden="true">↗</span></a></div></section>`);
 const heading=route.label==='The ecosystem'?'The full value stream':route.label;
 return head(heading,'INFUSED Las Vegas. '+heading+'. Explore the connected infused-products ecosystem.')+
 `<body class="dj-detail dj-${route.id}" data-page="${route.id}" data-chapter="${route.chapter.toLowerCase()}">${header(route.id)}${noScriptNav()}<div class="dj-ambient" aria-hidden="true"></div>${introNav(route)}<main id="main" tabindex="-1" class="dj-main"><div class="dj-content">`+
 ((route.id==='ecosystem'||route.id==='opportunities')?`<div class="dj-cover-art" aria-hidden="true" style="background-image:url('${imagesRoot}${route.photo}')"></div>`:'')+
 `<div class="dj-source-section">${content}</div></div>${related(route)}</main>${footer()}<canvas class="dj-water" aria-hidden="true"></canvas></body></html>`;
}
function applicationPage(){
 // Reuse the exact guided buyer question/answer sequence from the existing test prototype.
 return load('src/index.html').then(html=>{
   const form=html.match(/<form class="buyer-form" id="buyer-form"[\s\S]*?<\/form>/)?.[0];
   if(!form)throw Error('Missing trusted buyer application form');
   // Preview wizard is a DIV, not a form. Without JavaScript, no native POST or GET
   // can transmit a user's typed contact information by accident.
   const safe=form.replace(/<form class="buyer-form" id="buyer-form"[^>]*>/,'<div class="buyer-form" id="buyer-form">').replace(/<\/form>$/,'</div>').replaceAll('—',' - ');
   return head('Hosted Buyer Profile','INFUSED Hosted Buyers: share your sourcing priorities through a six-step guided profile preview.')+
   `<body class="dj-detail dj-apply" data-page="buyers/apply" data-chapter="who">${header('buyers')}${noScriptNav()}${introNav({num:'02',chapter:'WHO',label:'Buyer profile',next:'buyers'})}<main id="main" class="dj-application"><section class="dj-app-head"><span class="dj-kicker">HOSTED BUYERS / BUYER PROFILE</span><h1>THE RIGHT MEETINGS<br><em>START WITH WHAT YOU NEED.</em></h1><p>Source smarter. Meet the right suppliers. Build a meeting schedule around what you are actually looking to buy.</p><p class="dj-status-note">Preview only. Information entered here is not submitted or stored.</p></section><div class="dj-wizard"><div class="dj-wizard-meter"><span id="buyer-current">01 / 06</span><div role="progressbar" id="buyer-meter" aria-label="Buyer profile progress" aria-valuemin="1" aria-valuemax="6" aria-valuenow="1"><span id="buyer-meter-fill"></span></div><span>ROLE · SOURCING · PRIORITIES · COMPANY · CONTACT · REVIEW</span></div>${safe}</div></main>${footer()}<canvas class="dj-water" aria-hidden="true"></canvas></body></html>`;
 });
}
function cleanHome(html){
 if(!html.includes('{{DROP_ART_INTRO}}')||!html.includes('{{DROP_ART_STAGE}}'))throw Error('Missing shared droplet source markers');
 html=html.replaceAll('{{DROP_ART_INTRO}}',dropArt('intro')).replaceAll('{{DROP_ART_STAGE}}',dropArt('stage'));
 // V1.5 authentic droplet and buyer modal: preserve scripted IDs and semantics.
 html=html.replaceAll('{{STYLES}}',`/* v1.5 original animation, tuned for shared S02 */\n${'{{ORIGINAL_CSS}}'}\n${'{{S02_OVERRIDES}}'}`)
     .replaceAll('{{SCRIPT}}','{{ORIGINAL_JS}}');
 html=html.replaceAll('href="https://infused.show/"','href="'+BASE+'"');
 html=html.replaceAll('aria-label="INFUSED original website"','aria-label="INFUSED journey home"');
 for(const id of ['market','ecosystem','roots','science','make','package','move','sell','services','buyers','why-vegas','opportunities','contact','tickets']) html=html.replaceAll(`href="/${id}/"`,`href="${href(id)}"`);
 html=html.replaceAll('https://shows.map-dynamics.com/infusedlv2027/?register=', 'https://infused.show/go/booth?position=hero&amp;page=%2F');
 html=html.replaceAll('AN INTERACTIVE PREVIEW / 01—05','WHERE CATEGORIES CONNECT');
 html=html.replaceAll('A GUIDED PROFILE PREVIEW','HOSTED BUYERS / PROFILE');
 html=html.replaceAll('PROFILE PREVIEW','BUYER PROFILE');
 html=html.replaceAll('AN INTERACTIVE PREVIEW','');
 html=html.replaceAll('GO DIRECT','EXPLORE');
 html=html.replaceAll('NOW EXPLORING','');
 html=html.replaceAll('USE ← → TO NAVIGATE','');
 html=html.replaceAll('SCROLL NATURALLY','');
 html=html.replaceAll('href="https://form.jotform.com/262867873887079"','href="'+href('contact')+'"');
 html=html.replaceAll('Return to current INFUSED site ↗','Attend / tickets ↗');
 html=html.replaceAll('href="'+BASE+'" class="menu-return"',`href="${href('tickets')}" class="menu-return"`);
 html=html.replace('href="'+href('contact')+'" target="_blank" rel="noopener noreferrer"','href="'+href('contact')+'"');
 // Clear direct paths in the journey menu for all five high-intent personas.
 html=html.replace('<a class="menu-return"',`<a href="${href('opportunities')}#sponsorship">Sponsorship <span aria-hidden="true">↗</span></a><a class="menu-return"`);
 html=html.replace('<a href="'+href('market')+'">Market size',`<a href="${href('opportunities')}">Exhibit <span aria-hidden="true">↗</span></a><a href="${href('market')}">Market size`);
 // A complete static destination menu is also available with JavaScript disabled.
 html=html.replace('</main>',`${noScriptNav()}</main>`);
 html=html.replace(/<button id="motion-optin"[^>]*>[\s\S]*?<\/button>/,'');
 // The homepage and subpages share the same five direct-purpose links.
 // Replace the legacy menu, including its broken "Tickets" return link.
 const homeNav=`<nav class="site-nav" id="site-nav" aria-label="Explore INFUSED" hidden><p class="menu-kicker">Choose your direction</p>${links().map(([key,label])=>`<a href="${menuHref(key)}">${esc(label)} <span aria-hidden="true">↗</span></a>`).join('')}</nav>`;
 if(!/<nav class="site-nav" id="site-nav"[\s\S]*?<\/nav>/.test(html))throw Error('Homepage navigation markup missing');
 html=html.replace(/<nav class="site-nav" id="site-nav"[\s\S]*?<\/nav>/,homeNav);
 html=html.replaceAll('<title>INFUSED | Follow the Drop | Experience Prototype</title>','<title>INFUSED Las Vegas | From Roots to Retail</title>');
 html=html.replaceAll('name="dropjourney-prototype-version" content="1.5.0"','name="dropjourney-site-version" content="2.3.0-s05"');
 // The authoritative S04 prototype template already carries a site-version meta tag.
 if(!/name="dropjourney-site-version" content="[^"]+"/.test(html))throw Error('DJ-S05 homepage version marker missing');
 html=html.replace(/name="dropjourney-site-version" content="[^"]+"/,'name="dropjourney-site-version" content="2.3.0-s05"');
 html=html.replaceAll('An interactive, five-chapter preview of INFUSED Las Vegas: From Roots to Retail.','INFUSED Las Vegas. The national business event for the entire infused-products ecosystem.');

 // Reproduce published date and venue from one preview data source.
 const caption=/<p class="date-caption">[^<]*<\/p>/;
 const lockup=/<div class="date-lockup"><strong>[\s\S]*?<\/strong><div><span>[^<]*<\/span><span>[^<]*<\/span><\/div><\/div>/;
 const location=/<div class="vegas-location">[\s\S]*?<\/div><\/div>/;
 if(!caption.test(html)||!lockup.test(html)||!location.test(html))throw Error('DJ-S05 homepage event markup moved: inspect before deploy');
 html=html.replace(caption,`<p class="date-caption">${esc(event.dateLabel)} · ${esc(event.venue)}</p>`);
 html=html.replace(lockup,`<div class="date-lockup"><strong>${monthName.toUpperCase()}<span>${startDate.day}–${endDate.day}</span></strong><div><span>${startDate.year}</span><span>${esc(event.venue.toUpperCase())}</span></div></div>`);
 html=html.replace(location,match=>match.replace(/<strong>[^<]*<\/strong>/,`<strong>${esc(event.venue)}</strong>`).replace(/(<\/strong><span>)[^<]*(<\/span>)/,(_,a,z)=>a+esc(event.city)+z));
 html=html.replace('<!-- TURNSTILE_WIDGET -->','');
 // A no-script browser must never post buyer contact information.
 if(!/<form class="buyer-form" id="buyer-form"[^>]*>/.test(html))throw Error('Expected buyer profile scaffold');
 html=html.replace(/<form class="buyer-form" id="buyer-form"[^>]*>/,'<div class="buyer-form" id="buyer-form">').replace('</form>','</div>');
 return html;
}
async function write(rel,content){const file=path.join(output,rel);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,content,'utf8');}
await rm(path.join(root,'dist'),{recursive:true,force:true});
await mkdir(path.join(output,'assets','images'),{recursive:true});
for(const name of (await readdir(path.join(source,'assets','images'))).filter(s=>/\.(webp|png|jpe?g|svg)$/i.test(s))) await copyFile(path.join(source,'assets','images',name),path.join(output,'assets','images',name));
await write('assets/site.css',css);
await write('assets/site.js',js);
const [styleOriginal,styleOverrides,scriptOriginal]=await Promise.all([load('src/styles.css'),load('src/home.css'),load('src/app.js')]);
let home=cleanHome(await load('src/index.html'));
const safeScript=scriptOriginal.replace('form.elements.namedItem(name)', 'form.querySelector(`[name="${name}"]`)');
if(safeScript===scriptOriginal)throw Error('Buyer compatibility patch missing');
home=home.replaceAll('{{ORIGINAL_CSS}}',()=>styleOriginal)
  .replaceAll('{{S02_OVERRIDES}}',()=>styleOverrides)
  .replaceAll('{{ORIGINAL_JS}}',()=>safeScript);
await write('index.html',home);
for(const route of catalog)await write(`${route.id}/index.html`,await detailPage(route));
await write('buyers/apply/index.html',await applicationPage());
// Explicitly no preview collection endpoints, nor scripts that can POST to production.
await write('robots.txt','User-agent: *\nDisallow: /\n');
console.log(`Built ${catalog.length+2} pages (journey + ${catalog.length} production counterparts + buyer profile) under ${BASE}`);
