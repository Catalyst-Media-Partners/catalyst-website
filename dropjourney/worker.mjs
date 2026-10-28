// This Worker owns ONLY /dropjourneytest and its descendants.
// The site's separate production Worker, commerce, DNS, secrets and D1 are untouched.
const ROOT='/dropjourneytest';
const ROBOTS='noindex, nofollow, noarchive';
export default {
  async fetch(request,env){
    const url=new URL(request.url);
    const pathname=url.pathname;
    if(pathname!==ROOT && !pathname.startsWith(ROOT+'/')){
      return new Response('Not found',{status:404,headers:{'X-Robots-Tag':ROBOTS}});
    }
    if(request.method!=='GET'&&request.method!=='HEAD'){
      return new Response('Method not allowed',{status:405,headers:{Allow:'GET, HEAD','X-Robots-Tag':ROBOTS}});
    }
    if(pathname===ROOT){
      url.pathname=ROOT+'/';
      return Response.redirect(url.toString(),308);
    }
    if(/\/(?:tickets\/api|go\/booth|buyers\/api)(?:\/|$)/i.test(pathname)){
      return new Response('Not found',{status:404,headers:{'X-Robots-Tag':ROBOTS}});
    }
    const result=await env.ASSETS.fetch(request);
    const headers=new Headers(result.headers);
    headers.set('X-Robots-Tag',ROBOTS);
    headers.set('X-Content-Type-Options','nosniff');
    headers.set('Referrer-Policy','strict-origin-when-cross-origin');
    headers.set('X-DropJourney-Version','2.8.0-s10');
    if(headers.get('Content-Type')?.includes('text/html')){
      headers.set('Cache-Control','no-store');
      headers.delete('ETag');
    }
    return new Response(request.method==='HEAD'?null:result.body,{status:result.status,statusText:result.statusText,headers});
  }
};
