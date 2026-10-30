// S06/S07: source-preserving editorial ecosystem and sector page composition.
// The canonical HTML in src/sections/* continues to own all factual copy.
const decode = value => String(value).replace(/&quot;/g,'"').replace(/&#39;/g,"'");
const first = (source,expression,label) => {
  const match = String(source).match(expression);
  if(!match) throw Error('DJ-S06 canonical source missing '+label);
  return match[0];
};
const heading = source => first(source,/<h1\b[^>]*>[\s\S]*?<\/h1>/i,'h1');
const lead = source => first(source,/<p class="section-lead">[\s\S]*?<\/p>/i,'section lead');
const kicker = source => first(source,/<span class="kicker">[\s\S]*?<\/span>/i,'kicker');
const subject = (source,name) => {
  const r = source.match(new RegExp('<'+name+'\\b[^>]*>([\\s\\S]*?)<\\/'+name+'>','i'));
  return r ? r[1] : '';
};
const safeRoute = path => {
  if(!/^[a-z][a-z-]*$/.test(path)) throw Error('Unrecognized canonical sector slug: '+path);
  return path;
};
const roleIndex=(taxonomy,slug)=>taxonomy.stages.findIndex(s=>s.id===slug);
export function checkTaxonomy(taxonomy,catalog){
  if(!Array.isArray(taxonomy.stages)||taxonomy.stages.length!==7||taxonomy.connector?.id!=='buyers')throw Error('DJ-S06 invalid ecosystem taxonomy');
  const ids=taxonomy.stages.map(s=>safeRoute(s.id));
  if(new Set(ids).size!==7||!['roots','science','make','package','move','sell','services'].every(k=>ids.includes(k)))throw Error('DJ-S06 missing or duplicate category');
  for(const id of [...ids,'buyers'])if(!catalog.some(r=>r.id===id))throw Error('DJ-S06 taxonomy and route list mismatch: '+id);
  return true;
}
export function renderEcosystem(source,{href,taxonomy}){
  const sourceCards=[...source.matchAll(/<a class="eco-card"[\s\S]*?<\/a>/g)].map(m=>m[0]);
  if(sourceCards.length!==8)throw Error('DJ-S06 ecosystem card count changed (expected eight canonical cards)');
  const byRoute=new Map();
  for(const card of sourceCards){
    const id=card.match(/href="(?:\/dropjourneytest)?\/([a-z-]+)\/"/)?.[1];
    if(!id||byRoute.has(id))throw Error('DJ-S06 duplicate/unexpected ecosystem canonical link');
    byRoute.set(id,{
      title:decode(first(card,/<div class="eco-head">[\s\S]*?<\/div>/,'category title')).replace(/<[^>]+>/g,'').replace(/↗/g,'').trim(),
      body:first(card,/<p>[\s\S]*?<\/p>/,'category description'),
      img:first(card,/<img\b[^>]*>/,'category image'),
      style:card.match(/style="([^"]+)"/)?.[1]||''
    });
  }
  if(![...taxonomy.stages.map(x=>x.id),taxonomy.connector.id].every(k=>byRoute.has(k)))throw Error('DJ-S06 taxonomy not represented in production ecosystem');
  const stages=taxonomy.stages.map((s,i)=>{
    const data=byRoute.get(s.id);const label=data.title||s.id.replace(/-/g,' ').toUpperCase();
    return `<a class="dj-stream-node" role="listitem" href="${href(s.id)}" data-stage="${s.id}" style="${data.style}"><span class="dj-stream-num" aria-hidden="true">${String(i+1).padStart(2,'0')} / 07</span><span class="dj-stream-photo">${data.img}</span><span class="dj-stream-caption"><strong>${label}</strong>${data.body}<span class="dj-stream-open" aria-hidden="true">Explore ↗</span></span></a>`;
  }).join('');
  const buyer=byRoute.get('buyers');
  const tagline=source.match(/<div class="eco-tagline">[\s\S]*?<\/div>/)?.[0]||'';
  return `<section class="section dj-stream-page" id="ecosystem" aria-labelledby="ecosystem-title"><div class="container"><header class="dj-stream-head">${kicker(source)}${heading(source)}${lead(source)}<div class="dj-topic-actions"><a class="dj-btn dj-btn-acid" href="${href('opportunities')}">Explore exhibit options <span aria-hidden="true">↗</span></a><a class="dj-btn dj-btn-quiet" href="${href('buyers')}">Hosted buyers <span aria-hidden="true">↗</span></a></div></header><div class="dj-stream-key"><span>THE VALUE STREAM</span><span>SEVEN CONNECTED STAGES</span></div><div class="dj-stream" role="list" aria-label="Seven connected INFUSED value stream categories">${stages}</div><aside class="dj-stream-buyer" aria-label="Hosted buyer pathway"><div><span class="dj-sector-kicker">CONNECTED ACROSS THE VALUE STREAM</span><h2>HOSTED BUYERS</h2>${buyer.body}<a class="dj-stream-buyer-link" href="${href('buyers')}">Explore the buyer experience <span aria-hidden="true">↗</span></a></div><a href="${href('buyers')}" class="dj-stream-buyer-image" aria-label="Learn about hosted buyers">${buyer.img}</a></aside>${tagline}</div></section>`;
}
export function renderSector(source,route,{href,taxonomy,catalog,base='/dropjourneytest/'}){
  const idx=roleIndex(taxonomy,route.id);
  const downstream=idx>=4;
  if(idx<0)throw Error('DJ-S06 unsupported sector '+route.id);
  const blocks=[...source.matchAll(/<article class="detail-box\b[^>]*>[\s\S]*?<\/article>/g)].map(x=>x[0]);
  if(!blocks.length)throw Error('DJ-S06 no canonical industry topics for '+route.id);
  const image=source.match(/<img class="detail-photo\b[^>]*>/)?.[0]||`<img class="detail-photo" src="${base}assets/images/${route.photo}" alt="${route.label} industry sector" width="1450" height="960" decoding="async" loading="eager">`;
  const footer=source.match(/<div class="detail-footer">[\s\S]*?<\/div>/)?.[0]||'';
  const prev=idx>0?taxonomy.stages[idx-1].id:'ecosystem',next=idx<taxonomy.stages.length-1?taxonomy.stages[idx+1].id:'buyers';
  const topics=blocks.map((block,i)=>{
    const title=first(block,/<h3\b[^>]*>[\s\S]*?<\/h3>/,'topic heading '+route.id).replace('<h3','<h2').replace('</h3>','</h2>');
    const text=first(block,/<p>[\s\S]*?<\/p>/,'topic description '+route.id);
    return `<article class="dj-sector-topic"><span class="dj-topic-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div>${title}${text}</div></article>`;
  }).join('');
  // Short production sectors remain factual while connected category imagery gives them depth.
  const adjacent=blocks.length===1?`<section class="dj-sector-adjacent" aria-label="Connected categories"><span class="dj-sector-adjacent-label">CONNECTED ALONG THE VALUE STREAM</span><div class="dj-sector-adjacent-links">${[prev,next].map((id,i)=>{const peer=catalog.find(x=>x.id===id);if(!peer||!peer.photo)throw Error('DJ-X1 missing adjacent category '+id);return `<a class="dj-cross-link" href="${href(id)}"><img src="${base}assets/images/${peer.photo}" alt="" width="850" height="425" decoding="async" loading="lazy"><span><small>${i===0?'PREVIOUS':'NEXT'} CATEGORY</small><strong>${peer.label}</strong></span></a>`;}).join('')}</div></section>`:'';
  return `<section class="section dj-sector-page ${downstream?'dj-phase-downstream':'dj-phase-upstream'}" id="${route.id}" aria-labelledby="${route.id}-title"><div class="container"><div class="dj-sector-intro"><div class="dj-sector-copy"><span class="dj-sector-kicker">FROM ROOTS TO RETAIL / ${String(idx+1).padStart(2,'0')} OF 07</span>${kicker(source)}${heading(source)}${lead(source)}<div class="dj-topic-actions"><a class="dj-btn dj-btn-acid" href="${href('opportunities')}">Explore exhibit options <span aria-hidden="true">↗</span></a><a class="dj-btn dj-btn-quiet" href="${href(downstream?'buyers':'ecosystem')}">${downstream?'Explore hosted buyers':'See the ecosystem'} <span aria-hidden="true">↗</span></a></div></div><figure class="dj-sector-image">${image}<figcaption>${route.label} / INFUSED ecosystem</figcaption></figure></div><div class="dj-sector-details"><div class="dj-sector-details-intro"><span class="dj-sector-kicker">THE ${route.label.toUpperCase()} CATEGORY</span><h2>WHAT CONNECTS HERE.</h2><p>The partners, products and capabilities described in this part of the INFUSED value stream.</p>${footer}</div><div class="dj-sector-topic-list">${topics}</div></div>${adjacent}<nav class="dj-sector-nav" aria-label="Explore adjacent sectors"><a href="${href(prev)}"><small>PREVIOUS</small><strong>${prev==='ecosystem'?'All categories':prev.replace(/-/g,' ').toUpperCase()}</strong></a><a href="${href('ecosystem')}"><small>ALL CATEGORIES</small><strong>THE ECOSYSTEM</strong></a><a href="${href(next)}"><small>NEXT</small><strong>${next==='buyers'?'Hosted buyers':next.toUpperCase()}</strong></a></nav></div></section>`;
}