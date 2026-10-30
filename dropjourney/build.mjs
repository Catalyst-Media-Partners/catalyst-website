import {readFile, mkdir, readdir, copyFile, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderMarket,renderVegas} from './src/s05-pages.mjs';
import {validateLanders,renderLander} from './src/landing-pages.mjs';
import {renderEcosystem,renderSector,checkTaxonomy} from './src/s06-pages.mjs';
import {renderBuyers} from './src/s08-pages.mjs';
import {renderOpportunities,renderContact,renderTickets} from './src/s09-pages.mjs';
import {renderIntakeForm} from './src/intake-form.mjs';

// Two explicit build modes share one source tree. Preview remains the default.
const root=path.dirname(fileURLToPath(import.meta.url));
const mode=process.env.INFUSED_MODE||'preview';
if(!['preview','production'].includes(mode))throw Error('INFUSED_MODE must be preview or production');
const source=process.env.INFUSED_SRC?path.resolve(process.env.INFUSED_SRC):path.resolve(root,'../src');
const output=path.join(root,'dist',mode==='production'?'production':'dropjourneytest');
const BASE=mode==='production'?'/':'/dropjourneytest/';
const INDEXABLE=mode==='production';
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
const css=(await load('src/site.css'))+'\n'+(await load('src/s05.css'))+'\n'+(await load('src/s06.css'))+'\n'+(await load('src/s08.css'))+'\n'+(await load('src/s09.css'))+'\n'+(await load('src/finish.css'));
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
const brandFilename='infused-wordmark-shaded-web-hd.png';
const brandPath=path.join(root,'src','assets','images',brandFilename);
const brandData=await readFile(brandPath);
const logo=imagesRoot+brandFilename;
const embeddedLogo='data:image/png;base64,'+brandData.toString('base64');
if(!originalHome.includes('assets/images/'+brandFilename))throw Error('Homepage and official high-res wordmark asset diverged');
const shop='https://infused.show/go/booth?position=navigation&amp;page=%2F';
function links(){return [
 ['opportunities','Exhibit / reserve a booth'],['tickets','Attend / tickets'],
 ['buyers','Hosted buyers'],['sponsor','Sponsor'],['contact','Contact the team'],
 ['market','Market opportunity'],['ecosystem','The ecosystem'],['why-vegas','Why Vegas']
 ];}
const menuHref=id=>id==='sponsor'?href('opportunities')+'#sponsorship':href(id);
function noScriptNav(){return `<noscript><nav class="dj-nojs" aria-label="Explore INFUSED without JavaScript"><p>Explore INFUSED</p><a href="${BASE}#why">Why INFUSED</a><a href="${BASE}#who">Who attends</a><a href="${BASE}#when">When</a><a href="${BASE}#where">Where</a><a href="${BASE}#what">What to do</a>${links().map(([key,label])=>`<a href="${menuHref(key)}">${esc(label)}</a>`).join('')}</nav></noscript>`;}
function head(title,description,pagePath=BASE){const robots=INDEXABLE?'index, follow':'noindex,nofollow,noarchive';const canonical=INDEXABLE?`<link rel="canonical" href="https://infused.show${pagePath}">`:'';return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="robots" content="${robots}"><meta name="infused-base" content="${BASE}"><meta name="theme-color" content="#100e17"><meta name="description" content="${esc(description)}"><meta name="dropjourney-site-version" content="2.9.2-native-intake"><title>${esc(title)} | INFUSED Las Vegas</title>${canonical}<link rel="stylesheet" href="${BASE}assets/site.css"><script src="${BASE}assets/site.js" defer></script><script src="${BASE}assets/intake.js" defer></script></head>`;}
function header(id){return `<a class="dj-skip" href="#main">Skip to content</a><header class="dj-header" id="top"><a class="dj-logo" href="${BASE}" aria-label="INFUSED journey home"><img src="${logo}" alt="INFUSED" width="1588" height="358"></a><div class="dj-header-actions"><button type="button" class="dj-explore" aria-expanded="false" aria-controls="dj-drawer"><span class="dj-menu-mark" aria-hidden="true"><i></i><i></i></span>Explore</button><a class="dj-top-action" href="${shop}">Reserve a booth <span aria-hidden="true">↗</span></a></div><nav id="dj-drawer" class="dj-drawer" aria-label="Explore INFUSED" hidden><span class="dj-menu-eyebrow">Discover your way through INFUSED</span><a href="${BASE}" class="dj-menu-home">The journey <span aria-hidden="true">↗</span></a>${links().map(([key,label])=>`<a href="${menuHref(key)}" ${key===id?'aria-current="page"':''}>${esc(label)} <span aria-hidden="true">↗</span></a>`).join('')}<div class="dj-drawer-foot"><span>FROM ROOTS TO RETAIL</span><span>LAS VEGAS ${startDate.year}</span></div></nav></header>`;}
function footer(){return `<footer class="dj-footer"><div><a href="${BASE}" class="dj-footer-logo"><img src="${logo}" alt="INFUSED" width="1588" height="358"></a><p>The national business event for the entire infused-products ecosystem.</p></div><div class="dj-footer-links"><a href="${href('ecosystem')}">Ecosystem</a><a href="${href('opportunities')}">Exhibit</a><a href="${href('buyers')}">Hosted buyers</a><a href="${href('tickets')}">Tickets</a><a href="${href('contact')}">Contact</a></div><p class="dj-footer-date">${esc(event.dateLabel)}<br>${esc(event.venue)}</p></footer>`;}
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
function related(route){
 const act=route.id==='opportunities'||route.id==='contact'?{url:shop,label:'Browse available booth space',heading:'Make your next move.'}
  :route.id==='buyers'?{url:href('buyers/apply'),label:'Explore the buyer profile',heading:'Start with what you need.'}
  :route.id==='tickets'?{url:href('ecosystem'),label:'Discover the INFUSED ecosystem',heading:'Explore what comes next.'}
  :{url:href('opportunities'),label:'Explore exhibit opportunities',heading:'Make your next connection.'};
 return `<aside class="dj-related" aria-label="Next actions"><span class="dj-kicker">YOUR NEXT MOVE</span><h2>${act.heading}</h2><a class="dj-related-primary" href="${act.url}">${act.label} <span aria-hidden="true">&#8599;</span></a><div class="dj-related-row"><a href="${href(route.next)}"><span>${esc(catalog.find(x=>x.id===route.next)?.label||'The ecosystem')}</span><span aria-hidden="true">&#8599;</span></a><a href="${href('opportunities')}"><span>Explore exhibit options</span><span aria-hidden="true">&#8599;</span></a>${route.id!=='buyers'?`<a href="${href('buyers')}"><span>Discover hosted buyers</span><span aria-hidden="true">&#8599;</span></a>`:`<a href="${href('buyers/apply')}"><span>Buyer profile</span><span aria-hidden="true">&#8599;</span></a>`}</div></aside>`;
}
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
 if(['roots','science','make','package','move','sell','services'].includes(route.id))content=renderSector(content,route,{href,taxonomy,catalog});
 if(route.id==='opportunities') content=content.replace('<article class="detail-box green"><h3>Sponsorship</h3>','<article class="detail-box green" id="sponsorship"><h3>Sponsorship</h3>');
 if(route.id==='buyers')content=renderBuyers(content,{href});
 if(route.id==='opportunities')content=renderOpportunities(content,{href,event,photo:imagesRoot+route.photo});
 if(route.id==='contact')content=renderContact(content,{href,event});
 if(route.id==='tickets')content=renderTickets(content,{href,event,base:BASE});
 const heading=route.label==='The ecosystem'?'The full value stream':route.label;
 return head(heading,'INFUSED Las Vegas. '+heading+'. Explore the connected infused-products ecosystem.',href(route.id))+
 `<body class="dj-detail dj-${route.id}" data-page="${route.id}" data-chapter="${route.chapter.toLowerCase()}">${header(route.id)}${noScriptNav()}<div class="dj-ambient" aria-hidden="true"></div>${introNav(route)}<main id="main" tabindex="-1" class="dj-main"><div class="dj-content">`+
 ((route.id==='ecosystem'||route.id==='opportunities')?`<div class="dj-cover-art" aria-hidden="true" style="background-image:url('${imagesRoot}${route.photo}')"></div>`:'')+
 `<div class="dj-source-section">${content}</div></div>${route.id==='opportunities'?'':related(route)}</main>${footer()}<canvas class="dj-water" aria-hidden="true"></canvas></body></html>`;
}
function applicationPage(){
 return Promise.resolve(head('Hosted Buyer Request','Submit a first-party INFUSED Hosted Buyer inquiry, reviewed by the INFUSED team.',href('buyers/apply'))+
 '<body class="dj-detail dj-apply" data-page="buyers/apply" data-chapter="who">'+header('buyers')+noScriptNav()+introNav({num:'02',chapter:'WHO',label:'Buyer request',next:'buyers'})+
 '<main id="main" class="dj-application"><section class="dj-app-head dj-app-head-visual"><div class="dj-app-intro"><span class="dj-kicker">HOSTED BUYERS / REQUEST CONSIDERATION</span><span class="dj-sector-kicker">'+event.dateLabel+' / '+event.venue+'</span>'+
 '<h1>THE RIGHT MEETINGS<br><em>START WITH WHAT YOU NEED.</em></h1><p>Tell INFUSED what you source and whom you want to meet. A request is not a confirmed hosted-buyer benefit, acceptance or meeting.</p>'+
 '<div class="dj-topic-actions"><a class="dj-btn dj-btn-acid" href="#buyer-request-form" data-intake-type="hosted-buyer">Request buyer consideration <span aria-hidden="true">↘</span></a><a class="dj-btn dj-btn-quiet" href="'+href('buyers')+'">Hosted Buyer information <span aria-hidden="true">↗</span></a></div></div>'+
 '<figure class="dj-apply-photo"><img src="'+imagesRoot+'brand-representative-in-a-hosted-buyer-discussion-at-a-booth-18.webp" alt="Business representatives discussing sourcing" width="1400" height="933" decoding="async" loading="eager"><figcaption>Products / partners / conversations</figcaption></figure></section>'+
 renderIntakeForm('buyer',{base:BASE})+
 '<section class="dj-secure-intake" aria-label="Request process"><h2>What happens after submission?</h2><div class="dj-intake-steps"><p><strong>1 · Request received</strong> We save your sourcing priorities securely and provide a receipt.</p><p><strong>2 · Team review</strong> The INFUSED team reviews the request and may contact you.</p><p><strong>3 · No automatic acceptance</strong> Your request is not a confirmed meeting, benefit or ticket.</p></div></section>'+
 '</main>'+footer()+'<canvas class="dj-water" aria-hidden="true"></canvas></body></html>');
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
 html=html.replaceAll('href="/buyers/apply/"','href="'+href('buyers/apply')+'"');
 html=html.replaceAll('https://shows.map-dynamics.com/infusedlv2027/?register=', 'https://infused.show/go/booth?position=hero&amp;page=%2F');
 html=html.replaceAll('AN INTERACTIVE PREVIEW / 01—05','WHERE CATEGORIES CONNECT');
 html=html.replaceAll('A GUIDED PROFILE PREVIEW','HOSTED BUYERS / PROFILE');
 html=html.replaceAll('PROFILE PREVIEW','BUYER PROFILE');
 html=html.replaceAll('AN INTERACTIVE PREVIEW','');
 html=html.replaceAll('GO DIRECT','EXPLORE');
 html=html.replaceAll('NOW EXPLORING','');
 html=html.replaceAll('USE ← → TO NAVIGATE','');
 html=html.replaceAll('SCROLL NATURALLY','');
 // Homepage source now uses the native /contact/ route.
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
 html=html.replaceAll('name="dropjourney-prototype-version" content="1.5.0"','name="dropjourney-site-version" content="2.9.2-native-intake"');
 // The authoritative S04 prototype template already carries a site-version meta tag.
 if(!/name="dropjourney-site-version" content="[^"]+"/.test(html))throw Error('DJ-S05 homepage version marker missing');
 html=html.replace(/name="dropjourney-site-version" content="[^"]+"/,'name="dropjourney-site-version" content="2.9.2-native-intake"');
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
 // Buyer inquiries use the native first-party request route.
 // The homepage never embeds a second hosted form or collects PII itself.
 if(/id="buyer-dialog"|id="buyer-form"|data-open-buyer/.test(html))throw Error('DJ-U3 obsolete homepage buyer wizard remains');
 const robotsContent=INDEXABLE?'index, follow':'noindex, nofollow, noarchive';
 if(/<meta name="robots"[^>]*>/i.test(html))html=html.replace(/<meta name="robots"[^>]*>/i,'<meta name="robots" content="'+robotsContent+'">');
 else html=html.replace('</head>','<meta name="robots" content="'+robotsContent+'">\\n</head>');
 html=html.replace('</head>','<meta name="infused-base" content="'+BASE+'">'+(INDEXABLE?'<link rel="canonical" href="https://infused.show/">':'')+'\\n</head>');
 return html;
}
async function write(rel,content){const file=path.join(output,rel);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,content,'utf8');}
await rm(path.join(root,'dist'),{recursive:true,force:true});
await mkdir(path.join(output,'assets','images'),{recursive:true});
for(const name of (await readdir(path.join(source,'assets','images'))).filter(s=>/\.(webp|png|jpe?g|svg)$/i.test(s))) await copyFile(path.join(source,'assets','images',name),path.join(output,'assets','images',name));
await copyFile(brandPath,path.join(output,'assets','images',brandFilename));
await write('assets/site.css',css);
await write('assets/site.js',js);
 await write('assets/intake.js',await load('src/intake.js'));
await write('assets/ticket-notify.js',await load('src/ticket-notify.js'));
const [styleOriginal,styleOverrides,scriptOriginal]=await Promise.all([load('src/styles.css'),load('src/home.css'),load('src/app.js')]);
const combinedHomeStyles=styleOverrides+'\n'+(await load('src/finish.css'));
let home=cleanHome(await load('src/index.html'));
const safeScript=scriptOriginal;
home=home.replaceAll('{{ORIGINAL_CSS}}',()=>styleOriginal)
  .replaceAll('{{S02_OVERRIDES}}',()=>combinedHomeStyles)
  .replaceAll('{{ORIGINAL_JS}}',()=>safeScript);
await write('index.html',home);
for(const route of catalog)await write(`${route.id}/index.html`,await detailPage(route));
await write('buyers/apply/index.html',await applicationPage());
// Standalone HTML campaign output, with inline brand media and no external assets.
const campaignConfig=JSON.parse(await load('content/landers.json'));
const exportDir=path.join(root,'exports','landers');
await mkdir(exportDir,{recursive:true});
const [landingCss,landingJs,landingArt]=await Promise.all([load('src/landing.css'),load('src/landing.js'),load('src/drop-art.svg')]);
const offers=validateLanders(campaignConfig);
for(const offer of offers){
 const html=renderLander({offer,config:campaignConfig,logo:embeddedLogo,art:landingArt,css:landingCss,js:landingJs});
 await write('land/'+offer.id+'/index.html',html);
 await writeFile(path.join(exportDir,'infused-'+offer.id+'.html'),html,'utf8');
 if(offer.id===campaignConfig.default)await write('land/index.html',html);
}
// The only native inquiry endpoint is same-origin and consented.
await write('robots.txt',INDEXABLE?'User-agent: *\nAllow: /\nSitemap: https://infused.show/sitemap.xml\n':'User-agent: *\nDisallow: /\n');
if(INDEXABLE){
 const pages=['/',...catalog.map(x=>href(x.id)),href('buyers/apply')];
 const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+pages.map(p=>'  <url><loc>https://infused.show'+p+'</loc></url>').join('\n')+'\n</urlset>\n';
 await write('sitemap.xml',xml);
}
console.log('Built '+(catalog.length+2)+' full-site routes and '+(offers.length+1)+' campaign landers in '+mode+' mode under '+BASE+'; exported '+offers.length+' standalone HTML files');
