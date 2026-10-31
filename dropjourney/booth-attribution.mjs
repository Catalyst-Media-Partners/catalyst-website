/** First-party INFUSED booth CTA attribution. Uses the site's canonical D1 binding. */
const LV27_CHECKOUT='https://shows.map-dynamics.com/infusedlv2027/?register';
const UTM_KEYS=['utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
const CTA_POSITIONS=new Set(['hero','navigation','opportunities','contact']);
const ROUTES=new Set(['/','/lander/','/market/','/ecosystem/','/roots/','/science/','/make/','/package/','/move/','/sell/','/services/','/buyers/','/buyers/apply/','/why-vegas/','/opportunities/','/contact/','/tickets/']);
const TOKEN_PATTERN=/^[A-Za-z0-9][A-Za-z0-9._~-]{0,95}$/;
const HOST_PATTERN=/^[a-z0-9](?:[a-z0-9.-]{0,118}[a-z0-9])?$/;
function vettedToken(value){
 if(typeof value!=='string'||!TOKEN_PATTERN.test(value))return null;
 return value;
}
function trackingInput(url){
 const params=url.searchParams;
 const rawPosition=params.get('position');
 const requestedPath=params.get('page');
 const knownPath=ROUTES.has(requestedPath)?requestedPath:'/';
 const rawHost=(params.get('referrer_host')||'').toLowerCase();
 const ownHosts=['infused.show','www.infused.show','light.infused.show','dark.infused.show'];
 const referrerHost=HOST_PATTERN.test(rawHost)&&!ownHosts.includes(rawHost)?rawHost:null;
 const utm=Object.fromEntries(UTM_KEYS.map(key=>[key,vettedToken(params.get(key))]));
 return {position:CTA_POSITIONS.has(rawPosition)?rawPosition:'other',page:knownPath,referrerHost,utm};
}
function checkoutRedirect(clickId=null,utm={}){
 const destination=new URL(LV27_CHECKOUT);
 if(clickId){
  destination.searchParams.set('catalyst_click_id',clickId);
  for(const key of UTM_KEYS)if(utm[key])destination.searchParams.set(key,utm[key]);
 }
 return new Response(null,{status:302,headers:{
  'Location':destination.href,
  'Cache-Control':'no-store',
  'Referrer-Policy':'no-referrer',
  'X-Robots-Tag':'noindex, nofollow, noarchive',
  'X-Content-Type-Options':'nosniff'
 }});
}
export async function boothClick(request,env,url,isProduction){
 if(request.method!=='GET')return new Response('Method not allowed',{status:405,headers:{'Allow':'GET'}});
 // Non-production aliases never write acquisition events to the canonical D1.
 if(!isProduction||!env.INTAKE_DB)return checkoutRedirect();
 const input=trackingInput(url),clickId=crypto.randomUUID();
 try{
  await env.INTAKE_DB.prepare(
   'INSERT INTO web_acquisition_clicks_v1 '+
   '(click_id,market_key,site_host,entry_path,cta_position,referrer_host,'+
   'utm_source,utm_medium,utm_campaign,utm_content,utm_term) '+
   'VALUES (?,?,?,?,?,?,?,?,?,?,?)'
  ).bind(
   clickId,'LV27','infused.show',input.page,input.position,input.referrerHost,
   input.utm.utm_source,input.utm.utm_medium,input.utm.utm_campaign,
   input.utm.utm_content,input.utm.utm_term
  ).run();
  // Map Dynamics click-ID forwarding remains off unless separately validated.
  return env.MAPD_CLICK_ID_FORWARD_ENABLED==='true'
   ?checkoutRedirect(clickId,input.utm)
   :checkoutRedirect();
 }catch{
  console.warn('lv27_click_tracking_unavailable');
  return checkoutRedirect();
 }
}
