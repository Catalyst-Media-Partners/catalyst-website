/**
 * Independent INFUSED site Worker.
 * On workers.dev, the site is a noindex preview. On the two explicitly approved
 * future production hostnames, the same static source becomes indexable.
 * No hostnames or DNS mappings are changed by this Worker.
 */
const HOST = 'infused.show';
const WWW = 'www.infused.show';
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
  '/why-vegas/', '/opportunities/', '/contact/'
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
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const isProduction = host === HOST || host === WWW;
    if (host === WWW) {
      const next = new URL(request.url);
      next.hostname = HOST;
      return Response.redirect(next, 308);
    }
    const legacyKey = url.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const legacyDestination = LEGACY_REDIRECTS[legacyKey];
    if (legacyDestination) {
      const next = new URL(legacyDestination, url);
      next.search = url.search;
      return Response.redirect(next.toString(), 301);
    }
    if (url.pathname === '/robots.txt') {
      const rules = isProduction ? 'User-agent: *\nAllow: /\nSitemap: https://infused.show/sitemap.xml\n' : 'User-agent: *\nDisallow: /\n';
      return new Response(rules, {
        headers: headersFor(isProduction, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
      });
    }
    if (url.pathname === '/sitemap.xml') {
      if (!isProduction) return new Response('Not found', { status: 404, headers: headersFor(false, { 'Content-Type': 'text/plain' }) });
      const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        routes.map(route => `  <url><loc>https://${HOST}${route}</loc></url>`).join('\n') +
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
      const canonical = `https://${HOST}${canonicalPath}`;
      html = html.replace('</head>', `<link rel="canonical" href="${canonical}">\n</head>`);
      headers.delete('Content-Length');
      headers.delete('Content-Encoding');
      headers.delete('ETag');
      return new Response(html, { status: asset.status, statusText: asset.statusText, headers });
    }
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  }
};
