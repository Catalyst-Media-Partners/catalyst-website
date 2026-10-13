/** Standalone INFUSED website. Workers.dev is noindex; the future domain is production. */
const apex='infused.show', www='www.infused.show';
const routes=['/','/market/','/ecosystem/','/roots/','/science/','/make/','/package/','/move/','/sell/','/services/','/buyers/','/why-vegas/','/opportunities/','/contact/'];
const secure=(prod,old)=>{const h=new Headers(old);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','strict-origin-when-cross-origin');h.set('X-Frame-Options','SAMEORIGIN');if(prod)h.delete('X-Robots-Tag');else h.set('X-Robots-Tag','noindex, nofollow, noarchive');return h;};
export default {async fetch(request,env){
 const url=new URL(request.url),host=url.hostname.toLowerCase(),prod=host===apex||host===www;
 if(host===www){const next=new URL(request.url);next.hostname=apex;return Response.redirect(next,308);}
 if(url.pathname==='/robots.txt'){const text=prod?'User-agent: *\nAllow: /\nSitemap: https://infused.show/sitemap.xml\n':'User-agent: *\nDisallow: /\n';return new Response(text,{headers:secure(prod,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'})});}
 if(url.pathname==='/sitemap.xml'){
  if(!prod)return new Response('Not found',{status:404,headers:secure(false,{'Content-Type':'text/plain'})});
  const xml='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+routes.map(x=>'  <url><loc>https://'+apex+x+'</loc></url>').join('\n')+'\n</urlset>\n';
  return new Response(xml,{headers:secure(true,{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'})});
 }
 const asset=await env.ASSETS.fetch(request),headers=secure(prod,asset.headers);
 if(!prod&&headers.get('Content-Type')?.includes('text/html'))headers.set('Cache-Control','no-store');
 if(prod&&asset.ok&&headers.get('Content-Type')?.includes('text/html')){
  let html=await asset.text();
  html=html.replace('<meta name="robots" content="noindex, nofollow, noarchive">','<meta name="robots" content="index, follow">');
  let p=url.pathname.endsWith('/index.html')?url.pathname.slice(0,-10):url.pathname;
  p=p.endsWith('/')?p:p+'/';html=html.replace('</head>','<link rel="canonical" href="https://'+apex+p+'">\n</head>');
  headers.delete('Content-Length');headers.delete('Content-Encoding');headers.delete('ETag');
  return new Response(html,{status:asset.status,statusText:asset.statusText,headers});
 }
 return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers});
}};
