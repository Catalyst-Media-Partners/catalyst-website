// INFUSED Drop Journey Worker. Preview and production differ only by explicit configuration.
import {intakePath,handleIntake,flushIntakeOutbox} from './intake.mjs';
import {ticketPrefix,handleTicketRequest} from './ticket-notify.mjs';
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
const normalizeBase=value=>{
 const base=typeof value==='string'?value:'/dropjourneytest/';
 if(!base.startsWith('/')||!base.endsWith('/')||base.includes('..')||base.includes('?'))throw new Error('Invalid site base path');
 return base;
};
const allowedHosts=env=>(env.SITE_ALLOWED_HOSTS||'infused.show').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const canonicalPath=pathname=>{
 const clean=pathname.replace(/\/index\.html$/,'/');
 return clean.endsWith('/')?clean:clean+'/';
};

async function serveLightLander(request,env,url,indexable){
 if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','X-Robots-Tag':NOINDEX}});
 if(!env.LIGHT_SITE?.fetch)return new Response('Light landing page is temporarily unavailable.',{status:503,headers:headersFor(false,{'Cache-Control':'no-store'})});
 const target=new URL('/',url);
 const lightRequest=request.method==='HEAD'
  ?new Request(target,{method:'GET',headers:request.headers})
  :new Request(target,request);
 const light=await env.LIGHT_SITE.fetch(lightRequest);
 if(!light.ok||!light.headers.get('Content-Type')?.includes('text/html'))return light;
 let html=await light.text();
 const robots=indexable?'index, follow':NOINDEX;
 if(!/<base\b/i.test(html))html=html.replace(/<head(?:\s[^>]*)?>/i,match=>match+'\n<base href="/">');
 if(/<meta name="robots" content="[^"]*">/i.test(html))html=html.replace(/<meta name="robots" content="[^"]*">/i,'<meta name="robots" content="'+robots+'">');
 else html=html.replace('</head>','<meta name="robots" content="'+robots+'">\n</head>');
 const canonical='https://infused.show/lander/';
 if(/<link rel="canonical" href="[^"]*">/i.test(html))html=html.replace(/<link rel="canonical" href="[^"]*">/i,'<link rel="canonical" href="'+canonical+'">');
 else html=html.replace('</head>','<link rel="canonical" href="'+canonical+'">\n</head>');
 const headers=new Headers(light.headers);
 headers.set('X-Robots-Tag',robots);
 if(!indexable)headers.set('Cache-Control','no-store');
 headers.delete('Content-Length');headers.delete('Content-Encoding');headers.delete('ETag');
 return new Response(request.method==='HEAD'?null:html,{status:light.status,statusText:light.statusText,headers});
}

const headersFor=(indexable,original)=>{
 const h=new Headers(original);
 h.set('X-Content-Type-Options','nosniff');
 h.set('Referrer-Policy','strict-origin-when-cross-origin');
 h.set('X-Robots-Tag',indexable?'index, follow':NOINDEX);
 h.set('X-DropJourney-Version','2.9.2-native-intake');
 return h;
};
export default {
 async fetch(request,env){
  const url=new URL(request.url),host=url.hostname.toLowerCase(),p=url.pathname;
  const base=normalizeBase(env.SITE_BASE_PATH);
  const baseRoot=base==='/'?'':base.slice(0,-1);
  const hosts=allowedHosts(env);
  if(url.protocol!=='https:'||!hosts.includes(host))return new Response('Misdirected request',{status:421,headers:headersFor(false,{'Content-Type':'text/plain; charset=utf-8'})});
  const indexable=env.SITE_MODE==='production'&&host==='infused.show';
  const intake=intakePath(env),tickets=ticketPrefix(env);
  if(p===intake)return handleIntake(request,env);
  if(p.startsWith(tickets+'/api/')||p===tickets+'/verify'||p===tickets+'/unsubscribe')return handleTicketRequest(request,env);
  if(p==='/go/booth'||p==='/go/booth/'){
   if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{Allow:'GET'}});
   if(!env.BOOTH_ATTRIBUTION?.fetch)return new Response('Booth checkout is temporarily unavailable.',{status:503,headers:headersFor(false,{'Cache-Control':'no-store'})});
   const target=new URL(request.url);target.protocol='https:';target.hostname='infused.show';
   return env.BOOTH_ATTRIBUTION.fetch(new Request(target,request));
  }
  if(host==='www.infused.show'){
   const next=new URL(request.url);next.hostname='infused.show';
   return Response.redirect(next,308);
  }
  // The dark journey owns the root. The original light homepage is served only
  // from /lander/ on the canonical hostname through the isolated light Worker.
  if(p==='/lander'||p==='/lander/'){
   if(host!=='infused.show'){
    const next=new URL(request.url);next.hostname='infused.show';next.pathname='/lander/';
    return Response.redirect(next.toString(),308);
   }
   if(p==='/lander'){
    const next=new URL(request.url);next.pathname='/lander/';
    return Response.redirect(next.toString(),308);
   }
   return serveLightLander(request,env,url,indexable);
  }
  if(base!=='/'&&p===baseRoot){url.pathname=base;return Response.redirect(url.toString(),308);}
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','X-Robots-Tag':NOINDEX}});
  if(base!=='/'&&p!==baseRoot&&!p.startsWith(baseRoot+'/'))return new Response('Not found',{status:404,headers:headersFor(false,{'Content-Type':'text/plain; charset=utf-8'})});
  const sitePath=base==='/'?p:p.slice(baseRoot.length)||'/';
  const legacyKey=sitePath.toLowerCase().replace(/\/+$/,'')||'/';
  if(base==='/'&&LEGACY_REDIRECTS[legacyKey]){
   const next=new URL(LEGACY_REDIRECTS[legacyKey],url);next.search=url.search;
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
   const robots=indexable?'index, follow':'noindex, nofollow, noarchive';
   html=html.replace(/<meta name="robots" content="[^"]*">/i,'<meta name="robots" content="'+robots+'">');
   const canonical='https://infused.show'+canonicalPath(sitePath);
   if(/<link rel="canonical" href="[^"]*">/i.test(html))html=html.replace(/<link rel="canonical" href="[^"]*">/i,'<link rel="canonical" href="'+canonical+'">');
   else if(indexable||host==='dark.infused.show')html=html.replace('</head>','<link rel="canonical" href="'+canonical+'">\n</head>');
   headers.delete('Content-Length');headers.delete('Content-Encoding');headers.delete('ETag');
   return new Response(request.method==='HEAD'?null:html,{status:asset.status,statusText:asset.statusText,headers});
  }
  return new Response(request.method==='HEAD'?null:asset.body,{status:asset.status,statusText:asset.statusText,headers});
 },
 async scheduled(_event,env,ctx){ctx.waitUntil(flushIntakeOutbox(env));}
};
