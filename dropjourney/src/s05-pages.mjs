// DJ-S05: Pure source-to-source presentation. All figures, forecasts, source
// URLs, Las Vegas positioning and original photography are taken directly from
// the authoritative INFUSED GitHub source sections at build time.

const required = (source, expression, description) => {
  const match = source.match(expression);
  if (!match) throw Error(`DJ-S05: required ${description} missing from canonical source`);
  return match;
};
const plainText = value => String(value).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// Only source matching keys are stored here. No market numbers, projections,
// geography or publication dates are re-authored in the preview build.
const sourcePathByMarket = new Map([
  ['Functional Drinks', 'functional-drinks-market'],
  ['Dietary Supplements', 'dietary-supplements-market-report'],
  ['Nutraceuticals', 'nutraceuticals-market-102530'],
  ['U.S. Cannabis Edibles', 'us-cannabis-edibles-market'],
  ['THC Seltzers', 'thc-seltzers-market-report'],
]);

export function renderMarket(source, {href}) {
  const intro = required(source, /<header class="section-head">[\s\S]*?<\/header>/, 'market introduction')[0];
  const photos = required(source, /<div class="photo-ribbon"[^>]*>[\s\S]*?<\/div>/, 'market imagery')[0];
  const stats = required(source, /<div class="stats-grid">([\s\S]*?)<\/div>\s*<div class="why-stat">/, 'five market figures')[1];
  const takeaway = required(source, /<div class="why-stat">[\s\S]*?<\/div>/, 'exhibitor context')[0];
  const nonAdditive = required(source, /<p class="stats-note">[\s\S]*?<\/p>/, 'non-additive market caveat')[0];
  const citations = required(source, /<p class="sources">[\s\S]*?<\/p>/, 'source citations')[0];
  const originalLinks = [...citations.matchAll(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => ({url:m[1], label:plainText(m[2])}));
  const originalStats = [...stats.matchAll(/<article class="stat"[^>]*>[\s\S]*?<\/article>/g)].map(m => m[0]);
  if (originalStats.length !== 5 || originalLinks.length !== 5) throw Error('DJ-S05: expected exactly five canonical market figures and five sources');
  const seen = new Set();
  const figures = originalStats.map((item, i) => {
    const value = cls => plainText(required(item, new RegExp(`<[^>]+class="${cls}"[^>]*>([\\s\\S]*?)<\\/[^>]+>`), cls)[1]);
    const name = value('stat-name');
    const number = value('stat-number');
    const basis = value('stat-basis');
    const forecast = value('stat-forecast');
    const sourcePath = sourcePathByMarket.get(name);
    const citation = originalLinks.find(link => sourcePath && new URL(link.url).pathname.includes(sourcePath));
    if (!citation || seen.has(citation.url)) throw Error(`DJ-S05: no unique existing source for ${name}`);
    if (!/^https:\/\/(www\.)?(grandviewresearch\.com|fortunebusinessinsights\.com|emergenresearch\.com)\//.test(citation.url)) throw Error('DJ-S05: unapproved publisher URL in canonical content');
    seen.add(citation.url);
    if (!/\b20\d{2}\b/.test(basis) || !/(global|U\.S\.)/i.test(basis)) throw Error(`DJ-S05: missing date or geography on ${name}`);
    return `<article class="dj-evidence" role="listitem" aria-label="${escape(name)}, ${escape(number)}, ${escape(basis)}">
      <div class="dj-evidence-top"><span class="dj-evidence-index">${String(i+1).padStart(2,'0')} / 05</span><span class="dj-evidence-accent" aria-hidden="true"></span></div>
      <h3>${escape(name)}</h3><p class="dj-evidence-number">${escape(number)}</p><p class="dj-evidence-basis">${escape(basis)}</p>
      <p class="dj-evidence-forecast">${escape(forecast)}</p>
      <a class="dj-evidence-source" href="${escape(citation.url)}" target="_blank" rel="noopener noreferrer" aria-label="Source for ${escape(name)}: ${escape(citation.label)}"><span class="dj-evidence-source-label">Source</span><span class="dj-evidence-source-publisher">${escape(citation.label)}</span><span aria-hidden="true">↗</span></a>
    </article>`;
  });
  if (seen.size !== 5) throw Error('DJ-S05: missing distinct source URL');
  const photoMarkup = photos.replace(/(<img\b[^>]*?)\sloading="lazy"/, '$1 loading="eager" fetchpriority="high"');
  return `<section class="section soft dj-market-section" id="market" aria-labelledby="market-title"><div class="container">
    <div class="dj-market-lede"><div class="dj-market-intro">${intro}
      <div class="dj-page-actions"><a class="dj-btn dj-btn-acid" href="${href('opportunities')}">Explore exhibit options <span aria-hidden="true">↗</span></a><a class="dj-text-link" href="${href('ecosystem')}">Discover the ecosystem <span aria-hidden="true">↗</span></a></div>
    </div><div class="dj-market-visual">${photoMarkup}<p class="dj-market-image-label">RESEARCH / SUPPLY CHAIN / DISCOVERY</p></div></div>
    <div class="dj-market-data-head"><div><span class="dj-kicker">FIVE DISTINCT MARKETS</span><h2>Read the opportunity.<br><em>Know the context.</em></h2></div><a class="dj-market-method-link" href="#market-methodology">Sources and methodology <span aria-hidden="true">↓</span></a></div>
    <div class="dj-evidence-grid" role="list" aria-label="Five separate industry market estimates">${figures.join('')}</div>
    <div class="dj-market-bottom"><div class="dj-market-takeaway">${takeaway}<a href="${href('opportunities')}">Explore how to exhibit <span aria-hidden="true">↗</span></a></div>
    <details class="dj-market-methodology" id="market-methodology"><summary><span>How to read these figures</span><span class="dj-method-symbol" aria-hidden="true">+</span></summary>${nonAdditive}<p class="dj-source-method-copy">Each estimate retains its original publisher link in the corresponding market entry. Years and geography are shown alongside each value. The figures describe distinct but sometimes overlapping sectors.</p></details></div>
  </div></section>`;
}

export function renderVegas(source, {href, event}) {
  const photo = required(source, /<img class="detail-photo"[^>]*>/, 'destination photograph')[0]
    .replace('loading="lazy"','loading="eager" fetchpriority="high"');
  const kicker = required(source, /<span class="kicker">[\s\S]*?<\/span>/, 'destination kicker')[0];
  // detailPage() already upgrades the canonical source H2 to the sole page H1.
  const title = required(source, /<h1 id="vegas-title">[\s\S]*?<\/h1>/, 'original Las Vegas title')[0];
  const lead = required(source, /<p class="section-lead">[\s\S]*?<\/p>/, 'destination positioning')[0];
  const originalReasons = [...required(source, /<div class="vertical-list">([\s\S]*?)<\/div>/, 'destination reasons')[1].matchAll(/<article class="detail-box\b[^>]*>[\s\S]*?<\/article>/g)].map(m => m[0]);
  if (originalReasons.length !== 4) throw Error('DJ-S05: missing an original destination reason');
  const reasons = originalReasons.map((reason,i) => reason.replace(/<article class="(detail-box[^"]*)"([^>]*)>/,
    (_,classes,attrs) => `<article class="${classes} dj-vegas-reason"${attrs}><span class="dj-reason-index" aria-hidden="true">${String(i+1).padStart(2,'0')}</span>`));
  if (!event || !/^\d{4}-\d{2}-\d{2}$/.test(event.startDate) || !event.venue || !event.city || !event.dateLabel) throw Error('DJ-S05: canonical published event details missing');
  return `<section class="section soft dj-vegas-section" id="why-vegas" aria-labelledby="vegas-title"><div class="container">
    <div class="dj-vegas-hero"><div class="dj-vegas-photo">${photo}</div>
      <div class="dj-vegas-hero-copy">${kicker}${title}${lead}
        <div class="dj-page-actions"><a href="${href('tickets')}" class="dj-btn dj-btn-acid">Tickets and attendance <span aria-hidden="true">↗</span></a><a class="dj-text-link" href="${href('opportunities')}">Explore exhibit options <span aria-hidden="true">↗</span></a></div>
      </div><span class="dj-vegas-photo-credit">LAS VEGAS, NEVADA</span></div>
    <section class="dj-vegas-event" aria-labelledby="vegas-event-title"><div class="dj-vegas-event-head"><span class="dj-kicker">THE MEETING PLACE</span><h2 id="vegas-event-title">Where it comes together.</h2></div>
      <dl class="dj-vegas-facts"><div><dt>When</dt><dd>${escape(event.dateLabel)}</dd></div><div><dt>Venue</dt><dd>${escape(event.venue)}</dd></div><div><dt>City</dt><dd>${escape(event.city)}</dd></div></dl>
    </section>
    <section class="dj-vegas-why" aria-label="Why meet in Las Vegas"><div class="dj-vegas-why-heading"><span class="dj-kicker">THE DESTINATION</span><h2>Four reasons<br><em>to meet here.</em></h2></div><div class="dj-vegas-reason-grid">${reasons.join('')}</div></section>
    <div class="dj-vegas-next"><span class="dj-kicker">KEEP EXPLORING</span><p>Explore the INFUSED experience and the ways to take part.</p><div class="dj-page-actions"><a class="dj-btn dj-btn-acid" href="${href('opportunities')}">Explore exhibitor opportunities <span aria-hidden="true">↗</span></a><a class="dj-text-link" href="${href()}#when">Return to When <span aria-hidden="true">↗</span></a></div></div>
  </div></section>`;
}
