/* DJ-X1: portable campaign landers compiled from allowlisted source JSON. */
const safe=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const suffix='/dropjourneytest/';
export function validateLanders(config){
 if(config.schemaVersion!==1||config.siteOrigin!=='https://infused.show')throw Error('Campaign site origin or schema changed');
 if(!Array.isArray(config.variants)||config.variants.length<3||config.variants.length>12)throw Error('Campaign variant manifest invalid');
 const ids=new Set();
 for(const o of config.variants){
  if(!/^[a-z][a-z0-9-]{0,32}$/.test(o.id)||ids.has(o.id))throw Error('Duplicate/invalid campaign ID');
  ids.add(o.id);
  if(!['light','dark'].includes(o.theme))throw Error('Unsupported campaign color treatment');
  if(!Array.isArray(o.headline)||o.headline.length!==2||o.headline.some(x=>!x||x.length>64))throw Error('Campaign headline invalid: '+o.id);
  for(const k of ['eyebrow','lead','action','secondary'])if(typeof o[k]!=='string'||!o[k].trim()||o[k].length>300)throw Error('Campaign field invalid '+o.id+':'+k);
  for(const key of ['destination','secondaryDestination']){
   const value=o[key];
   if(typeof value!=='string'||!value.startsWith(suffix)||/\?|\/\/|\\|\.\./.test(value))throw Error('Unapproved campaign destination '+o.id+':'+key);
   if(!/^\/dropjourneytest\/(?:[a-z-]+(?:\/[a-z-]+)?\/)?(?:#[a-z0-9-]+)?$/.test(value))throw Error('Campaign route invalid '+o.id+':'+key);
  }
 }
 if(!ids.has(config.default))throw Error('Campaign default must be a compiled variant');
 return config.variants;
}
export function renderLander({offer,config,logo,art,css,js}){
 if(typeof logo!=='string'||!logo.startsWith('data:image/png;base64,'))throw Error('Cannot locate approved embedded INFUSED logo');
 if(typeof art!=='string'||!art.includes('drop-specular-__DROP_ID__'))throw Error('Missing original 3D INFUSED drop artwork');
 if(typeof css!=='string'||typeof js!=='string')throw Error('Landing CSS/JS missing');
 const title=offer.headline.join(' '),heading=offer.headline.map(s=>'<span>'+safe(s)+'</span>').join('');
 const drop=art.replaceAll('__DROP_ID__','lander-'+offer.id).replaceAll('__DROP_CLASS__','lander-vector');
 const dest=config.siteOrigin+offer.destination,secondary=config.siteOrigin+offer.secondaryDestination;
 return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive"><meta name="color-scheme" content="${offer.theme}">
<meta name="description" content="${safe(offer.lead)}"><meta name="theme-color" content="${offer.theme==='dark'?'#110f1b':'#f6f3ed'}">
<meta name="dropjourney-site-version" content="2.9.2-native-intake"><title>${safe(title)} | INFUSED Las Vegas</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'">
<style>${css}</style></head><body class="lander" data-theme="${offer.theme}" data-campaign="${offer.id}">
<a class="skip" href="#main">Skip to campaign</a>
<header class="lander-header"><span class="logo-frame"><img class="lander-logo" alt="INFUSED" src="${logo}" width="1588" height="358"></span><span class="lander-eyebrow">LAS VEGAS / FROM ROOTS TO RETAIL</span></header>
<main class="lander-main" id="main"><div class="lander-copy"><p class="lander-eyebrow">${safe(offer.eyebrow)}</p>
<h1>${heading}</h1><p class="lander-lead">${safe(offer.lead)}</p>
<div class="lander-actions"><a class="lander-cta" href="${safe(dest)}" data-offer-link data-primary="true">${safe(offer.action)} <span aria-hidden="true">&#8599;</span></a>
<a class="lander-secondary" href="${safe(secondary)}" data-offer-link>${safe(offer.secondary)} <span aria-hidden="true">&#8599;</span></a></div></div>
<div class="lander-art"><a class="lander-drop" href="${safe(dest)}" data-offer-link aria-label="Click the INFUSED drop: ${safe(offer.action)}">${drop}</a>
<p class="lander-drop-instruction">CLICK THE DROP / ${safe(offer.action)}</p></div></main>
<footer class="lander-foot"><span>INFUSED LAS VEGAS / THE FULL VALUE STREAM</span><a href="${config.siteOrigin}${suffix}" data-offer-link>Discover the full INFUSED journey</a></footer>
<canvas class="water-canvas" aria-hidden="true"></canvas><script>${js}</script></body></html>`;
}
