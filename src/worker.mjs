import ticketNotifications from './tickets/notifications.mjs';
/**
 * Independent INFUSED site Worker.
 * On workers.dev, the site is a noindex preview. On the two explicitly approved
 * future production hostnames, the same static source becomes indexable.
 * No hostnames or DNS mappings are changed by this Worker.
 */
const HOST = 'infused.show';
const WWW = 'www.infused.show';
const LIGHT_HOST = 'light.infused.show';
// Only verified legacy WordPress entry routes. Do not invent a privacy policy,
// speaker form, or hosted-buyer application to replace missing content.
const LEGACY_REDIRECTS = Object.freeze({
  '/getting-started': '/',
  '/event/las-vegas-2027': '/',
  '/exhibit': '/opportunities/',
  '/exhibitor-hub': '/opportunities/',
  '/become-an-exhibitor': '/contact/',
  '/become-a-speaker': '/contact/',
  '/become-a-sponsor': '/opportunities/'
});
const routes = [
  '/', '/market/', '/ecosystem/', '/roots/', '/science/', '/make/',
  '/package/', '/move/', '/sell/', '/services/', '/buyers/',
  '/why-vegas/', '/opportunities/', '/contact/', '/tickets/'
];
function headersFor(isProduction, original) {
  const headers = new Headers(original);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  if (isProduction) headers.delete('X-Robots-Tag');
  else headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return headers;
}
// First-party checkout handoff for the LV27 exhibitor funnel.
// This only records an anonymous CTA click; it NEVER attributes an order
// without independent vendor confirmation of this exact click_id.
const LV27_CHECKOUT = 'https://shows.map-dynamics.com/infusedlv2027/?register';
const UTM_KEYS = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
const CTA_POSITIONS = new Set(['hero','navigation','opportunities','contact']);
const TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,95}$/;
const HOST_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,118}[a-z0-9])?$/;

function vettedToken(value) {
  if (typeof value !== 'string' || !TOKEN_PATTERN.test(value)) return null;
  return value;
}
function trackingInput(url) {
  const params = url.searchParams;
  const rawPosition = params.get('position');
  const requestedPath = params.get('page');
  const knownPath = routes.includes(requestedPath) ? requestedPath : '/';
  const rawHost = (params.get('referrer_host') || '').toLowerCase();
  const referrerHost = HOST_PATTERN.test(rawHost) && !['infused.show','www.infused.show','light.infused.show','dark.infused.show'].includes(rawHost)
    ? rawHost : null;
  const utm = Object.fromEntries(UTM_KEYS.map(key => [key, vettedToken(params.get(key))]));
  return {
    position: CTA_POSITIONS.has(rawPosition) ? rawPosition : 'other',
    page: knownPath,
    referrerHost,
    utm
  };
}
function checkoutRedirect(url, clickId = null, utm = {}) {
  const destination = new URL(LV27_CHECKOUT);
  if (clickId) {
    destination.searchParams.set('catalyst_click_id', clickId);
    for (const key of UTM_KEYS) if (utm[key]) destination.searchParams.set(key, utm[key]);
  }
  return new Response(null, {
    status: 302,
    headers: {
      'Location': destination.href,
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
async function boothClick(request, env, url, isProduction, siteHost = HOST) {
  if (request.method !== 'GET') {
    return new Response('Method not allowed', {status:405,headers:{'Allow':'GET'}});
  }
  // The preview must never insert synthetic clicks into production D1.
  if (!isProduction || !env.AUDIENCE_DB) return checkoutRedirect(url);
  const input = trackingInput(url);
  const clickId = crypto.randomUUID();
  try {
    await env.AUDIENCE_DB.prepare(
      'INSERT INTO web_acquisition_clicks_v1 ' +
      '(click_id,market_key,site_host,entry_path,cta_position,referrer_host,' +
      'utm_source,utm_medium,utm_campaign,utm_content,utm_term) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(
      clickId,'LV27',siteHost,input.page,input.position,input.referrerHost,
      input.utm.utm_source,input.utm.utm_medium,input.utm.utm_campaign,
      input.utm.utm_content,input.utm.utm_term
    ).run();
    // Do not alter Map D's validated checkout URL until vendor compatibility
    // for extra campaign/click parameters has been demonstrated.
    const forwardVendorToken = env.MAPD_CLICK_ID_FORWARD_ENABLED === 'true';
    return forwardVendorToken
      ? checkoutRedirect(url, clickId, input.utm)
      : checkoutRedirect(url);
  } catch {
    // Checkout availability takes precedence over analytics availability.
    // Do not issue a seemingly attributable token when the write failed.
    console.warn('lv27_click_tracking_unavailable');
    return checkoutRedirect(url);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const isLightHost = host === LIGHT_HOST;
    const lightHostEnabled = env.LIGHT_HOST_PUBLISHED === 'true';
    if (isLightHost && !lightHostEnabled) {
      return new Response('Not found', {status:404,headers:headersFor(false,{'Content-Type':'text/plain; charset=utf-8'})});
    }
    const isProduction = host === HOST || host === WWW || (isLightHost && lightHostEnabled);
    const canonicalHost = isLightHost ? LIGHT_HOST : HOST;
    if (url.pathname === '/go/booth' || url.pathname === '/go/booth/') {
      return boothClick(request, env, url, isProduction, canonicalHost);
    }
    if (host === WWW) {
      const next = new URL(request.url);
      next.hostname = HOST;
      return Response.redirect(next, 308);
    }

    // W02: ticket interest, confirmation and unsubscribe, isolated from booth checkout.
    if (url.pathname === '/tickets' || url.pathname.startsWith('/tickets/')) {
      const configReady = isProduction && env.INFUSED_NOTIFY_ENABLED === 'true' &&
        env.AUDIENCE_DB && env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY &&
        env.RATE_SALT && env.MAILING_ADDRESS && env.AWS_SES_REGION &&
        env.AWS_SES_ACCESS_KEY_ID && env.AWS_SES_SECRET_ACCESS_KEY;
      let ready = Boolean(configReady);
      if (ready && url.pathname === '/tickets/') {
        try { await env.AUDIENCE_DB.prepare('SELECT email FROM ticket_notify_subscribers LIMIT 1').first(); }
        catch { ready = false; }
      }
      const notifyEnv = {
        ...env, DB: env.AUDIENCE_DB, IS_PRODUCTION: isProduction,
        INFUSED_NOTIFY_ENABLED: ready ? 'true' : 'false'
      };
      const response = await ticketNotifications.fetch(request, notifyEnv);
      if (isProduction && url.pathname === '/tickets/' && response.ok &&
          response.headers.get('Content-Type')?.includes('text/html')) {
        const html = (await response.text())
          .replace('<meta name="robots" content="noindex, nofollow, noarchive">',
            '<meta name="robots" content="index, follow">')
          .replace('</head>', '<link rel="canonical" href="${canonicalHost}/tickets/">\n</head>');
        const headers = headersFor(true, response.headers);
        headers.delete('Content-Length'); headers.delete('Content-Encoding'); headers.delete('ETag');
        return new Response(html, {status: response.status, headers});
      }
      return response;
    }
    const legacyKey = url.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const legacyDestination = LEGACY_REDIRECTS[legacyKey];
    if (legacyDestination) {
      const next = new URL(legacyDestination, url);
      next.search = url.search;
      return Response.redirect(next.toString(), 301);
    }
    if (url.pathname === '/robots.txt') {
      const rules = isProduction ? `User-agent: *\nAllow: /\nSitemap: https://${canonicalHost}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n';
      return new Response(rules, {
        headers: headersFor(isProduction, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
      });
    }
    if (url.pathname === '/sitemap.xml') {
      if (!isProduction) return new Response('Not found', { status: 404, headers: headersFor(false, { 'Content-Type': 'text/plain' }) });
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        routes.map(route => `  <url><loc>https://${canonicalHost}${route}</loc></url>`).join('\n') +
        '\n</urlset>\n';
      return new Response(xml, { headers: headersFor(true, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }) });
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = headersFor(isProduction, asset.headers);
    if (!isProduction && headers.get('Content-Type')?.includes('text/html')) headers.set('Cache-Control', 'no-store');
    if (isProduction && asset.ok && headers.get('Content-Type')?.includes('text/html')) {
      let html = await asset.text();
      // Content and visual design stay identical. Only deployment metadata changes.
      html = html.replace('<meta name="robots" content="noindex, nofollow, noarchive">', '<meta name="robots" content="index, follow">');
      const cleanPath = url.pathname.replace(/\/index\.html$/, '/');
      const canonicalPath = cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
      const canonical = `https://${canonicalHost}${canonicalPath}`;
      html = html.replace('</head>', `<link rel="canonical" href="${canonical}">\n</head>`);
      headers.delete('Content-Length');
      headers.delete('Content-Encoding');
      headers.delete('ETag');
      return new Response(html, { status: asset.status, statusText: asset.statusText, headers });
    }
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  }
};
