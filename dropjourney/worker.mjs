// Single INFUSED production site Worker: dark journey plus the original light /lander page.
import {intakePath,handleIntake,flushIntakeOutbox} from './intake.mjs';
import {ticketPrefix,handleTicketRequest} from './ticket-notify.mjs';
import {boothClick} from './booth-attribution.mjs';

const HOST='infused.show';
const NOINDEX='noindex, nofollow, noarchive';
const LEGACY_REDIRECTS=Object.freeze({
 '/getting-started':'/',
 '/event/las-vegas-2027':'/',
 '/exhibit':'/opportunities/',
 '/exhibitor-hub':'/opportunities/',
 '/become-an-exhibitor':'/contact/',
 '/become-a-speaker':'/contact/',
 '/become-a-sponsor':'/opportunities/'
});
function normalizeBase(value){
 const base=typeof value==='string'?value:'/dropjourneytest/';
 if(!base.startsWith('/')||!base.endsWith('/')||base.includes('..')||base.includes('?'))throw new Error('Invalid site base path');
 return base;
}
function allowedHosts(env){
 return (env.SITE_ALLOWED_HOSTS||'infused.show').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
}
function canonicalPath(pathname){
 const clean=pathname.replace(/\/index\.html$/,'/');
 return clean.endsWith('/')?clean:clean+'/';
}
function headersFor(indexable,original){
 const h=new Headers(original);
 h.set('X-Content-Type-Options','nosniff');
 h.set('Referrer-Policy','strict-origin-when-cross-origin');
 h.set('X-Robots-Tag',indexable?'index, follow':NOINDEX);
 h.set('X-DropJourney-Version','2.9.3-single-worker');
 return h;
}
async function serveLightLander(request,env,assetPath,indexable){
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','X-Robots-Tag':NOINDEX}});
 const assetUrl=new URL(request.url);
 assetUrl.pathname=assetPath;
 const asset=await env.ASSETS.fetch(new Request(assetUrl,request));
 const headers=headersFor(indexable,asset.headers);
 if(!asset.ok||!headers.get('Content-Type')?.includes('text/html'))return new Response(request.method==='HEAD'?null:asset.body,{status:asset.status,statusText:asset.statusText,headers});
 if(request.method==='HEAD')return new Response(null,{status:asset.status,statusText:asset.statusText,headers});
 let html=await asset.text();
 const robots=indexable?'index, follow':NOINDEX;
 if(/<meta name="robots" content="[^"]*">/i.test(html))html=html.replace(/<meta name="robots" content="[^"]*">/i,'<meta name="robots" content="'+robots+'">');
 else html=html.replace('</head>','<meta name="robots" content="'+robots+'">\n</head>');
 if(indexable){
  const canonical='https://infused.show/lander/';
  if(/<link rel="canonical" href="[^"]*">/i.test(html))html=html.replace(/<link rel="canonical" href="[^"]*">/i,'<link rel="canonical" href="'+canonical+'">');
  else html=html.replace('</head>','<link rel="canonical" href="'+canonical+'">\n</head>');
 }
 if(!indexable)headers.set('Cache-Control','no-store');
 headers.delete('Content-Length');
 headers.delete('Content-Encoding');
 headers.delete('ETag');
 return new Response(html,{status:asset.status,statusText:asset.statusText,headers});
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),host=url.hostname.toLowerCase(),p=url.pathname;
  const base=normalizeBase(env.SITE_BASE_PATH);
  const baseRoot=base==='/'?'':base.slice(0,-1);
  const hosts=allowedHosts(env);
  if(url.protocol!=='https:'||!hosts.includes(host))return new Response('Misdirected request',{status:421,headers:headersFor(false,{'Content-Type':'text/plain; charset=utf-8'})});

  // The retired light hostname is a redirect only. It never owns content or a Worker.
  if(host==='light.infused.show'){
   const next=new URL(request.url);
   next.hostname=HOST;
   next.pathname='/lander/';
   return Response.redirect(next,308);
  }
  if(host==='www.infused.show'){
   const next=new URL(request.url);
   next.hostname=HOST;
   return Response.redirect(next,308);
  }

  const indexable=env.SITE_MODE==='production'&&host===HOST;
  const intake=intakePath(env),tickets=ticketPrefix(env);
  if(p===intake)return handleIntake(request,env);
  if(p.startsWith(tickets+'/api/')||p===tickets+'/verify'||p===tickets+'/unsubscribe')return handleTicketRequest(request,env);

  if(p==='/go/booth'||p==='/go/booth/'){
   return boothClick(request,env,url,indexable);
  }

  const landerRoot=base+'lander/';
  const landerNoSlash=landerRoot.slice(0,-1);
  if(p===landerNoSlash){
   const next=new URL(request.url);
   next.pathname=landerRoot;
   return Response.redirect(next.toString(),308);
  }
  if(p===landerRoot+'index.html'){
   const next=new URL(request.url);
   next.pathname=landerRoot;
   return Response.redirect(next.toString(),308);
  }
  if(p===landerRoot){
   if(host!==HOST){
    const next=new URL(request.url);
    next.hostname=HOST;
    next.pathname='/lander/';
    return Response.redirect(next.toString(),308);
   }
   return serveLightLander(request,env,landerRoot,indexable);
  }
  if(p.startsWith(landerRoot))return new Response('Not found',{status:404,headers:headersFor(false,{'Content-Type':'text/plain; charset=utf-8'})});

  if(base!=='/'&&p===baseRoot){url.pathname=base;return Response.redirect(url.toString(),308);}
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','X-Robots-Tag':NOINDEX}});
  if(base!=='/'&&p!==baseRoot&&!p.startsWith(baseRoot+'/'))return new Response('Not found',{status:404,headers:headersFor(false,{'Content-Type':'text/plain; charset=utf-8'})});
  const sitePath=base==='/'?p:p.slice(baseRoot.length)||'/';
  const legacyKey=sitePath.toLowerCase().replace(/\/+$/,'')||'/';
  if(base==='/'&&LEGACY_REDIRECTS[legacyKey]){
   const next=new URL(LEGACY_REDIRECTS[legacyKey],url);
   next.search=url.search;
   return Response.redirect(next.toString(),301);
  }
  const robotsPath=base==='/'?'/robots.txt':base+'robots.txt';
  const sitemapPath=base==='/'?'/sitemap.xml':base+'sitemap.xml';
  if(p===robotsPath){
   const rules=indexable?'User-agent: *\nAllow: /\nSitemap: https://infused.show/sitemap.xml\n':'User-agent: *\nDisallow: /\n';
   return new Response(rules,{headers:headersFor(indexable,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'})});
  }
  if(p===sitemapPath&&!indexable)return new Response('Not found',{status:404,headers:headersFor(false,{'Content-Type':'text/plain; charset=utf-8'})});
  const asset=await env.ASSETS.fetch(request);
  const headers=headersFor(indexable,asset.headers);
  if(!indexable&&headers.get('Content-Type')?.includes('text/html'))headers.set('Cache-Control','no-store');
  if(asset.ok&&headers.get('Content-Type')?.includes('text/html')){
   let html=await asset.text();
   const robots=indexable?'index, follow':NOINDEX;
   html=html.replace(/<meta name="robots" content="[^"]*">/i,'<meta name="robots" content="'+robots+'">');
   const canonical='https://infused.show'+canonicalPath(sitePath);
   if(/<link rel="canonical" href="[^"]*">/i.test(html))html=html.replace(/<link rel="canonical" href="[^"]*">/i,'<link rel="canonical" href="'+canonical+'">');
   else if(indexable||host==='dark.infused.show')html=html.replace('</head>','<link rel="canonical" href="'+canonical+'">\n</head>');
   headers.delete('Content-Length');
   headers.delete('Content-Encoding');
   headers.delete('ETag');
   return new Response(request.method==='HEAD'?null:html,{status:asset.status,statusText:asset.statusText,headers});
  }
  return new Response(request.method==='HEAD'?null:asset.body,{status:asset.status,statusText:asset.statusText,headers});
 },
 async scheduled(_event,env,ctx){
  ctx.waitUntil(flushIntakeOutbox(env));
 }
};
