// Isolated preview Worker with one validated first-party intake endpoint.
import {INTAKE_PATH,handleIntake,flushIntakeOutbox} from './intake.mjs';
const ROOT='/dropjourneytest',ROBOTS='noindex, nofollow, noarchive';
export default {
 async fetch(request,env){
  const url=new URL(request.url),p=url.pathname;
  if(p!==ROOT&&!p.startsWith(ROOT+'/'))return new Response('Not found',{status:404,headers:{'X-Robots-Tag':ROBOTS}});
  if(p===INTAKE_PATH)return handleIntake(request,env);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','X-Robots-Tag':ROBOTS}});
  if(p===ROOT){url.pathname=ROOT+'/';return Response.redirect(url.toString(),308);}
  if(/\/(?:tickets\/api|go\/booth|buyers\/api)(?:\/|$)/i.test(p))return new Response('Not found',{status:404,headers:{'X-Robots-Tag':ROBOTS}});
  const r=await env.ASSETS.fetch(request),h=new Headers(r.headers);
  h.set('X-Robots-Tag',ROBOTS);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','strict-origin-when-cross-origin');
  h.set('X-DropJourney-Version','2.9.2-native-intake');
  if(h.get('Content-Type')?.includes('text/html')){h.set('Cache-Control','no-store');h.delete('ETag');}
  return new Response(request.method==='HEAD'?null:r.body,{status:r.status,statusText:r.statusText,headers:h});
 },
 async scheduled(_event,env,ctx){ctx.waitUntil(flushIntakeOutbox(env));}
};
