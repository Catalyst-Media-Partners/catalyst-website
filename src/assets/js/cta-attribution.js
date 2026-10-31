/**
 * INFUSED first-party campaign-to-booth-CTA handoff, without cookies or
 * local/session storage. No page impressions or personal details are sent.
 * Links retain their original Map D destination when JavaScript is disabled.
 */
(() => {
  if (!/^https?:$/.test(window.location.protocol)) return;
  const FIELDS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,95}$/;
  const HOST = /^[a-z0-9](?:[a-z0-9.-]{0,118}[a-z0-9])?$/;
  const ALLOWED_PAGES = new Set([
    '/','/lander/','/market/','/ecosystem/','/roots/','/science/','/make/',
    '/package/','/move/','/sell/','/services/','/buyers/',
    '/why-vegas/','/opportunities/','/contact/'
  ]);
  const incoming = new URLSearchParams(window.location.search);
  const campaign = new URLSearchParams();
  for (const key of FIELDS) {
    const value = incoming.get(key);
    if (value && TOKEN.test(value)) campaign.set(key,value);
  }
  // A referral hostname supports organic-search attribution without storing
  // full referring URLs, query strings or persistent browser identifiers.
  let referrerHost = (incoming.get('referrer_host') || '').toLowerCase();
  if (!HOST.test(referrerHost)) referrerHost = '';
  if (!referrerHost && document.referrer) {
    try {
      const ref = new URL(document.referrer);
      if (ref.origin !== window.location.origin) referrerHost = ref.hostname.toLowerCase();
    } catch { /* Invalid external referrer is not retained. */ }
  }
  if (HOST.test(referrerHost) && !['infused.show','www.infused.show','dark.infused.show','light.infused.show'].includes(referrerHost)) {
    campaign.set('referrer_host',referrerHost);
  }

  // Keep source context in first-party navigation URLs without using cookies.
  // Each field is untrusted campaign metadata, not verified user identity.
  for (const link of document.querySelectorAll('a[href]:not([data-track="lv27_booth_purchase"])')) {
    const raw = link.getAttribute('href');
    if (!raw || raw.startsWith('#')) continue;
    let destination;
    try { destination = new URL(raw,window.location.href); } catch { continue; }
    if (destination.origin !== window.location.origin || !ALLOWED_PAGES.has(destination.pathname)) continue;
    for (const [key,value] of campaign) {
      if (!destination.searchParams.has(key)) destination.searchParams.set(key,value);
    }
    if ([...campaign].length) link.href = destination.href;
  }

  // CTA clicks pass through a fixed first-party route before Map D checkout.
  for (const link of document.querySelectorAll('a[data-track="lv27_booth_purchase"]')) {
    const handoff = new URL('/go/booth',window.location.origin);
    handoff.searchParams.set('position',link.dataset.ctaPosition || 'other');
    handoff.searchParams.set('page',ALLOWED_PAGES.has(window.location.pathname) ? window.location.pathname : '/');
    for (const [key,value] of campaign) handoff.searchParams.set(key,value);
    link.href = handoff.href;
  }
})();
