// DJ-S09: safely render published commercial/attendance content without inventing offers.
import {renderIntakeForm} from './intake-form.mjs';
// Both purchase and enquiry URLs are read from the canonical source after S05 translation.
const must=(s,re,label)=>{const m=String(s).match(re);if(!m)throw Error('DJ-S09 missing canonical '+label);return m[0];};
const all=(s,re,count,label)=>{const values=[...s.matchAll(re)].map(m=>m[0]);if(values.length!==count)throw Error('DJ-S09 '+label+' count changed: '+values.length);return values;};
const text=s=>String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
export function renderOpportunities(source,{href,event,photo}){
 if(typeof photo!=='string'||!/^\/dropjourneytest\/assets\/images\/[a-z0-9-]+\.webp$/.test(photo))throw Error('DJ-X1 unapproved opportunities photo');
 const label=must(source,/<span class="kicker">[\s\S]*?<\/span>/,'opportunities label');
 const title=must(source,/<h1\b[^>]*>[\s\S]*?<\/h1>/,'opportunities headline');
 const lead=must(source,/<p class="section-lead">[\s\S]*?<\/p>/,'opportunities description');
 const topics=all(source,/<article class="detail-box\b[^>]*>[\s\S]*?<\/article>/g,6,'six commercial categories');
 const price=must(source,/<div class="booking-prompt-copy">[\s\S]*?<\/div>/,'published booth terms');
 const purchase=must(source,/<a class="btn btn-primary" href="https:\/\/infused\.show\/go\/booth[^" ]*"[^>]*>[\s\S]*?<\/a>/,'first-party booth purchase');
 const purchaseHref=purchase.match(/href="([^"]+)"/)?.[1];
 if(!purchaseHref)throw Error('DJ-S09 missing verified checkout URL');
 const sections=topics.map((raw,i)=>{
  const name=must(raw,/<h3>[\s\S]*?<\/h3>/,'offer type').replace('<h3>','<h2>').replace('</h3>','</h2>');
  const p=must(raw,/<p>[\s\S]*?<\/p>/,'offer description');
  const sponsor=/Sponsorship/i.test(name);
  return `<article class="dj-offer"${sponsor?' id="sponsorship"':''} role="listitem"><span class="dj-topic-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div>${name}${p}${sponsor?`<a href="${href('contact')}" class="dj-offer-link">Ask about sponsorship <span aria-hidden="true">↗</span></a>`:''}</div></article>`;
 });
 const sponsor=sections.find(s=>s.includes('id="sponsorship"'));
 const secondary=sections.filter(s=>!s.includes('id="sponsorship"'));
 if(!sponsor||secondary.length!==5)throw Error('DJ-U2 sponsorship must remain a direct, visible destination');
 if(!purchase.includes('https://infused.show/go/booth'))throw Error('DJ-S09 first-party purchase must stay unchanged');
 return `<section class="section dj-offers-page" id="opportunities" aria-labelledby="opps-title"><div class="container">
   <div class="dj-commercial-intro">
     <div class="dj-commercial-copy">${label}<span class="dj-sector-kicker">EXHIBIT / SHOWCASE / SPONSOR</span>${title}${lead}
       <div class="dj-topic-actions"><a class="dj-btn dj-btn-acid" href="${purchaseHref}">Browse available booth space <span aria-hidden="true">↗</span></a><a href="#sponsorship" class="dj-btn dj-btn-quiet">Explore sponsorship <span aria-hidden="true">↗</span></a></div>
     </div>
     <figure class="dj-offers-visual"><img src="${photo}" alt="Exhibitors and attendees discussing products at a trade show" width="1380" height="920" decoding="async" loading="eager"><figcaption>Products / relationships / opportunities</figcaption></figure>
   </div>
   <aside class="dj-offers-booking" aria-label="Booth pricing and purchase">
     <div class="dj-offers-booking-copy"><span class="dj-sector-kicker">${event.dateLabel} / ${event.venue}</span>${price}</div>
     <div class="dj-offers-booking-action">${purchase.replace('class="btn btn-primary"','class="dj-btn dj-btn-acid"')}<p>Final price and availability are confirmed in the official booking process.</p></div>
   </aside>
   <section class="dj-sponsor-spotlight" aria-label="Sponsorship option">${sponsor}</section>
   <details class="dj-more-pathways"><summary>Explore five other ways to participate</summary><div class="dj-offers-grid" role="list">${secondary.join('')}</div></details>
 </div></section>`;
}
export function renderContact(source,{href,event}){
 const label=must(source,/<span class="kicker">[\s\S]*?<\/span>/,'contact label');
 const title=must(source,/<h1\b[^>]*>[\s\S]*?<\/h1>/,'contact headline');
 const photo=must(source,/<img class="cta-photo"[^>]*>/,'original contact image');
 const original=source; // Nested CTA wrapper contains child divs: scan within the canonical section.
 const message=must(original,/<p>Browse available booth locations,[\s\S]*?<\/p>/,'contact source explanation');
 const links=all(original,/<a class="btn [^"]+"[^>]*>[\s\S]*?<\/a>/g,2,'two original approved contacts');
 const booth=links.find(x=>x.includes('/go/booth'));
 if(!booth)throw Error('DJ-U3 first-party booth handoff must be preserved');
 const caption=must(original,/<p class="endline">[\s\S]*?<\/p>/,'closing line');
 return `<section class="section dj-contact-page" id="contact" aria-labelledby="contact-title"><div class="container"><div class="dj-contact-hero"><div class="dj-contact-copy">${label}<span class="dj-sector-kicker">${event.dateLabel} / ${event.venue}</span>${title}${message}<div class="dj-contact-actions">${booth.replace('class="btn btn-primary"','class="dj-btn dj-btn-acid"')}<a href="#contact-request-form" class="dj-btn dj-btn-quiet">Contact INFUSED <span aria-hidden="true">↘</span></a></div><p class="dj-contact-support">Exhibiting, sponsoring, or seeking more information? Choose the appropriate route above.</p>${caption}</div><figure class="dj-contact-photo">${photo}<figcaption>Exhibitors and business conversations / INFUSED</figcaption></figure></div><nav class="dj-contact-next" aria-label="More ways to engage"><a href="${href('opportunities')}">Explore exhibit opportunities <span aria-hidden="true">↗</span></a><a href="${href('buyers')}">Explore Hosted Buyers <span aria-hidden="true">↗</span></a><a href="${href('tickets')}">Attendance and tickets <span aria-hidden="true">↗</span></a></nav>${renderIntakeForm('contact')}</div></section>`;
}
export function renderTickets(source,{href,event}){
 const title=must(source,/<h1\b[^>]*>[\s\S]*?<\/h1>/,'ticket headline');
 const photo=must(source,/<img class="hero-image"[^>]*>/,'ticket image');
 const lead=must(source,/<p class="hero-description">[\s\S]*?<\/p>/,'ticket announcement');
 const promo=must(source,/<div class="notify-promo">[\s\S]*?<\/div>/,'existing published ticket offer');
 if(!/25%/.test(promo))throw Error('DJ-S09 original ticket offer changed; do not invent offer');
 const promoTitle=must(promo,/<strong>[\s\S]*?<\/strong>/,'ticket promo title');
 // Tickets are unavailable; first-party attendance interest is consented and persisted.
 return `<section class="section dj-tickets-page" id="tickets" aria-labelledby="ticket-hero-title"><div class="container"><div class="dj-tickets-hero"><div class="dj-tickets-intro"><span class="dj-sector-kicker">${event.dateLabel} / ${event.venue}</span>${title}${lead}<p class="dj-ticket-state" role="status">Tickets are not yet on sale. You may request attendance updates; this does not reserve or purchase a ticket.</p><div class="dj-topic-actions"><a class="dj-btn dj-btn-acid" href="#attendee-interest-form" data-intake-type="attendee-interest">Request attendance updates <span aria-hidden="true">↗</span></a><a class="dj-btn dj-btn-quiet" href="${href('why-vegas')}">Explore Las Vegas <span aria-hidden="true">↗</span></a></div></div><figure class="dj-tickets-photo">${photo}<figcaption>Infused product discovery / Las Vegas</figcaption></figure></div><aside class="dj-promo-unavailable"><span class="dj-sector-kicker">PUBLISHED EARLY-BIRD OFFER</span>${promoTitle}<p>The published incentive is not activated in this preview. Eligibility and terms must be confirmed before ticket registration opens.</p></aside><nav class="dj-ticket-next" aria-label="Explore INFUSED"><a href="${href('ecosystem')}">Discover the ecosystem <span aria-hidden="true">↗</span></a><a href="${href('buyers')}">Hosted Buyers <span aria-hidden="true">↗</span></a></nav>${renderIntakeForm('attendee')}</div></section>`;
}