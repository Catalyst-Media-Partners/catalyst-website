import {confirmationEmail,SENDER} from './email.mjs';
const encoder=new TextEncoder();
const MINUTE=60_000,DAY=86_400_000,VERIFY_LIFETIME=7*DAY;
const BASE='https://infused.show';
const securityHeaders={
 'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
 'X-Frame-Options':'DENY','Cache-Control':'no-store',
 'Content-Security-Policy':"default-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
 'X-Robots-Tag':'noindex, nofollow, noarchive'
};
const formatDate=time=>new Date(time).toISOString();
const hex=buffer=>[...new Uint8Array(buffer)].map(x=>x.toString(16).padStart(2,'0')).join('');
const digest=async str=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(str)));
const randomToken=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('');};
const validToken=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const responseJson=(message,status=200)=>new Response(JSON.stringify({message}),{status,headers:{...securityHeaders,'Content-Type':'application/json; charset=utf-8'}});
const view=(content,status=200)=>new Response(content,{status,headers:{...securityHeaders,'Content-Type':'text/html; charset=utf-8'}});
const normalizeEmail=input=>{if(typeof input!=='string')return null;const value=input.trim().toLowerCase();if(value.length>254||!(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(value)))return null;const [local,domain]=value.split('@');if(local.length>64||local.startsWith('.')||local.endsWith('.')||local.includes('..')||!domain.split('.').every(x=>x.length<=63&&/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(x)))return null;return {email:value,domain};};
async function statePage({title,body,status=200,env,mode='verified',token=''}) {
  const route = ['verified','unsubscribe','unsubscribed'].includes(mode) ? mode : 'verified';
  if(env?.ASSETS) {
    try {
      const source=await env.ASSETS.fetch(new Request(`${BASE}/tickets/${route}/`));
      if(source.ok) {
        let html=await source.text();
        if(status>=400) html=html
          .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, `<h1>${escapeHtml(title)}</h1>`)
          .replace(/<p class="section-lead">[\s\S]*?<\/p>/i, `<p class="section-lead">${escapeHtml(body)}</p>`);
        if(mode==='unsubscribe') html=html.replace('name="token" value=""', `name="token" value="${escapeHtml(token)}"`);
        return view(html,status);
      }
    }catch{}
  }
  // Fail-safe markup for unavailable static assets; use the source site's palette.
  const css='body{margin:0;background:#f8f9fb;color:#201929;font-family:Arial,sans-serif}.accent-top{height:6px;background:#f72c92}.nav{padding:25px;background:white;border-bottom:1px solid #eae8ed}.page{max-width:900px;padding:80px 25px;margin:auto}.kicker{color:#b12d79;text-transform:uppercase;letter-spacing:2px;font-size:12px;font-weight:900}h1{font-size:clamp(36px,5vw,64px);line-height:1.05}.btn{display:inline-block;padding:17px 23px;background:#28164e;color:white;text-decoration:none;border-radius:8px}.foot{padding:24px;border-top:1px solid #eae8ed;background:white}';
  return view(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${escapeHtml(title)} | INFUSED Las Vegas</title><style>${css}</style></head><body><div class="accent-top"></div><header class="nav"><a href="${BASE}/"><img alt="INFUSED" src="${BASE}/assets/images/infused-logo-00.webp" width="154" height="42"></a></header><main class="page"><p class="kicker">INFUSED Las Vegas</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p><a class="btn" href="${BASE}/tickets/">Back to Tickets →</a></main><footer class="foot">INFUSED Las Vegas | From Roots to Retail</footer></body></html>`,status);
}
async function checkMx(domain){
 const u='https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(domain)+'&type=MX';
 let resp;try{resp=await fetch(u,{headers:{Accept:'application/dns-json'}});}catch{return null;}
 if(!resp.ok)return null;
 let obj;try{obj=await resp.json();}catch{return null;}
 if(obj.Status===3)return false;if(obj.Status!==0)return null;
 const mx=(obj.Answer||[]).filter(a=>a.type===15&&typeof a.data==='string');
 return mx.some(a=>!/^\s*0\s+\.$/.test(a.data.trim()))&&mx.length>0;
}
async function checkTurnstile(token,request,env){
 if(!env.TURNSTILE_SECRET_KEY||!env.TURNSTILE_SITE_KEY||!token||token.length>2048)return false;
 try{
  const res=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET_KEY,response:token,remoteip:request.headers.get('CF-Connecting-IP')||undefined})});
  if(!res.ok)return false;const t=await res.json();return Boolean(t.success&&t.hostname==='infused.show');
 }catch{return false;}
}
async function signingKey(secret,shortDate,region){
 const hmac=async(key,message)=>{const k=await crypto.subtle.importKey('raw',typeof key==='string'?encoder.encode(key):key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(message)));};
 const date=await hmac('AWS4'+secret,shortDate);const reg=await hmac(date,region);const svc=await hmac(reg,'ses');return hmac(svc,'aws4_request');
}
export async function sendBySes(env,to,emailContent,oneClickUrl){
 if(!env.AWS_SES_ACCESS_KEY_ID||!env.AWS_SES_SECRET_ACCESS_KEY||!env.AWS_SES_REGION)throw new Error('SES configuration incomplete');
 const region=env.AWS_SES_REGION,host=`email.${region}.amazonaws.com`,path='/v2/email/outbound-emails';
 const from=env.MAIL_FROM||SENDER;
 const body=JSON.stringify({FromEmailAddress:from,ReplyToAddresses:['joe@infusedvegas.com'],Destination:{ToAddresses:[to]},Content:{Simple:{Subject:{Data:emailContent.subject,Charset:'UTF-8'},Body:{Text:{Data:emailContent.text,Charset:'UTF-8'},Html:{Data:emailContent.html,Charset:'UTF-8'}},Headers:[{Name:'List-Unsubscribe',Value:`<${oneClickUrl}>`},{Name:'List-Unsubscribe-Post',Value:'List-Unsubscribe=One-Click'}]}}});
 const timestamp=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=timestamp.slice(0,8),scope=`${day}/${region}/ses/aws4_request`;
 const payloadHash=await digest(body);
 const headers={'content-type':'application/json','host':host,'x-amz-content-sha256':payloadHash,'x-amz-date':timestamp};
 if(env.AWS_SESSION_TOKEN)headers['x-amz-security-token']=env.AWS_SESSION_TOKEN;
 const signedNames=Object.keys(headers).sort(),signedHeaders=signedNames.join(';');
 const canonical=signedNames.map(x=>`${x}:${headers[x].trim()}\n`).join('');
 const canonicalRequest=`POST\n${path}\n\n${canonical}\n${signedHeaders}\n${payloadHash}`;
 const stringToSign=`AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${await digest(canonicalRequest)}`;
 const key=await signingKey(env.AWS_SES_SECRET_ACCESS_KEY,day,region);
 const authKey=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=hex(await crypto.subtle.sign('HMAC',authKey,encoder.encode(stringToSign)));
 const authorization=`AWS4-HMAC-SHA256 Credential=${env.AWS_SES_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
 const outbound=new Headers(headers);outbound.set('Authorization',authorization);
 const res=await fetch(`https://${host}${path}`,{method:'POST',headers:outbound,body});
 if(!res.ok)throw new Error(`SES returned HTTP ${res.status}`);
 return res;
}
async function subscribe(request,env){
 if(request.headers.get('origin')&&request.headers.get('origin')!==BASE)return responseJson('Request not allowed.',403);
 if(!env.IS_PRODUCTION||env.INFUSED_NOTIFY_ENABLED!=='true'||!env.DB||!env.RATE_SALT||!env.TURNSTILE_SECRET_KEY||!env.TURNSTILE_SITE_KEY||!env.MAILING_ADDRESS||!env.AWS_SES_ACCESS_KEY_ID||!env.AWS_SES_SECRET_ACCESS_KEY||!env.AWS_SES_REGION)return responseJson('Notifications are temporarily unavailable.',503);
 let input;try{const t=await request.text();if(t.length>6000)return responseJson('Request too large.',413);input=JSON.parse(t);}catch{return responseJson('Invalid request.',400);}
 const normalized=normalizeEmail(input.email);
 if(!normalized)return responseJson('Please enter a valid email address.',400);
 if(!await checkTurnstile(input.turnstile,request,env))return responseJson('Please complete the security check and try again.',400);
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return responseJson('Unable to validate request origin.',400);
 const ipHash=await digest(`${env.RATE_SALT}:${ip}`),hour=Math.floor(Date.now()/3600000);
 const attempts=await env.DB.prepare('INSERT INTO ticket_notify_rate(key_hash,hour_bucket,attempts) VALUES (?1,?2,1) ON CONFLICT(key_hash,hour_bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts').bind(ipHash,hour).first();
 if(attempts.attempts>8)return responseJson('Too many requests from this connection. Try again later.',429);
 const existing=await env.DB.prepare('SELECT state, verification_sent_at FROM ticket_notify_subscribers WHERE email=?').bind(normalized.email).first();
 if(existing?.state==='verified'||(existing?.verification_sent_at&&Date.now()-Date.parse(existing.verification_sent_at)<3600000))return responseJson('If this address is eligible, check your inbox for the verification email.');
 const domainOk=await checkMx(normalized.domain);
 if(domainOk===null)return responseJson('The email domain could not be checked right now. Please try again.',503);
 if(!domainOk)return responseJson('That email domain does not appear to receive mail. Check the spelling.',400);
 const token=randomToken(),unsubscribe=randomToken(),hash=await digest(token),unsubscribeHash=await digest(unsubscribe),now=formatDate(Date.now()),expires=formatDate(Date.now()+VERIFY_LIFETIME);
 await env.DB.prepare(`INSERT INTO ticket_notify_subscribers(email,email_domain,state,verification_hash,verification_expires_at,unsubscribe_hash,created_at,verification_sent_at,verified_at,unsubscribed_at)
 VALUES(?1,?2,'pending',?3,?4,?5,?6,NULL,NULL,NULL)
 ON CONFLICT(email) DO UPDATE SET state='pending',verification_hash=excluded.verification_hash,verification_expires_at=excluded.verification_expires_at,unsubscribe_hash=excluded.unsubscribe_hash,verification_sent_at=NULL,verified_at=NULL,unsubscribed_at=NULL
 WHERE ticket_notify_subscribers.state != 'verified'`).bind(normalized.email,normalized.domain,hash,expires,unsubscribeHash,now).run();
 const verifyUrl=`${BASE}/tickets/verify?token=${token}`,unsubUrl=`${BASE}/tickets/unsubscribe?token=${unsubscribe}`;
 const oneClick=`${BASE}/tickets/unsubscribe/one-click?token=${unsubscribe}`;
 try{await sendBySes(env,normalized.email,confirmationEmail({verifyUrl,unsubscribeUrl:unsubUrl,mailingAddress:env.MAILING_ADDRESS}),oneClick);}
 catch{return responseJson('We could not send your verification email right now. Please try again later.',503);}
 await env.DB.prepare('UPDATE ticket_notify_subscribers SET verification_sent_at=? WHERE email=? AND verification_hash=?').bind(now,normalized.email,hash).run();
 return responseJson('Check your inbox. We sent an email with a verification link. Please verify to qualify for early-bird access.');
}
async function verify(token,env){
 if(!env.DB||!validToken(token))return statePage({env,title:'Verification link unavailable',mode:'verified',icon:'!',body:'This link is invalid or expired. Return to the ticket page to request a new one.',status:400});
 const hash=await digest(token),now=formatDate(Date.now());
 const row=await env.DB.prepare("SELECT email FROM ticket_notify_subscribers WHERE verification_hash=? AND verification_expires_at>? AND state='pending'").bind(hash,now).first();
 if(!row)return statePage({env,title:'Verification link unavailable',mode:'verified',icon:'!',body:'This link has expired or was already used. Return to ticket notifications to request another.',status:400});
 const update=await env.DB.prepare("UPDATE ticket_notify_subscribers SET state='verified',verified_at=?,verification_hash=NULL,verification_expires_at=NULL WHERE email=? AND verification_hash=? AND state='pending'").bind(now,row.email,hash).run();
 if(!update?.meta?.changes)return statePage({env,title:'Verification link unavailable',mode:'verified',icon:'!',body:'This link could not be completed. Return to the ticket page and request another.',status:400});
 return statePage({env,mode:'verified',title:"You're verified. We'll notify you soon.",icon:'✓',body:'Thank you for confirming your email. You are on the INFUSED Las Vegas ticket list and eligible for the 25% early-bird admission offer. We will send the details when tickets go on sale.',extra:'<p class="state-note">No ticket has been purchased or reserved.</p>'});
}
async function processUnsubscribe(token,env){
 if(!env.DB||!validToken(token))return false;
 const hash=await digest(token);
 const r=await env.DB.prepare("UPDATE ticket_notify_subscribers SET state='unsubscribed',unsubscribed_at=?,verification_hash=NULL,verification_expires_at=NULL WHERE unsubscribe_hash=?").bind(formatDate(Date.now()),hash).run();
 return Boolean(r?.meta?.changes);
}
function unsubscribeForm(token,env){if(!validToken(token))return statePage({env,mode:'unsubscribe',title:'Link unavailable',body:'This unsubscribe link is invalid.',status:400});return statePage({env,mode:'unsubscribe',title:'Stop ticket notifications?',body:'You can unsubscribe from INFUSED Las Vegas ticket announcements at any time.',token});}
async function oneClick(request,env,token){
 if(request.method!=='POST')return new Response('Method not allowed',{status:405,headers:{...securityHeaders,Allow:'POST'}});
 if(request.headers.get('content-type')?.split(';')[0]!=='application/x-www-form-urlencoded')return new Response('Bad request',{status:400,headers:securityHeaders});
 const body=await request.text();if(body.trim()!=='List-Unsubscribe=One-Click')return new Response('Bad request',{status:400,headers:securityHeaders});
 return new Response(await processUnsubscribe(token,env)?'Unsubscribed':'Invalid link',{status:200,headers:securityHeaders});
}
async function ticketLanding(request,env){
 if(!env.ASSETS)return new Response('Assets unavailable',{status:503});
 const path=new URL('/tickets/',request.url);
 const asset=await env.ASSETS.fetch(new Request(path.toString(),request));
 if(!asset.ok)return asset;
 let html=await asset.text();
 const sitekey=env.IS_PRODUCTION && env.INFUSED_NOTIFY_ENABLED==='true' && env.DB && env.RATE_SALT && env.TURNSTILE_SECRET_KEY && env.MAILING_ADDRESS && env.AWS_SES_ACCESS_KEY_ID && env.AWS_SES_SECRET_ACCESS_KEY && env.AWS_SES_REGION ? String(env.TURNSTILE_SITE_KEY||'') : '';
 if(/^[a-zA-Z0-9_-]{10,120}$/.test(sitekey))html=html.replace('<!-- TURNSTILE_WIDGET -->',`<div class="cf-turnstile" data-sitekey="${sitekey}" data-action="infused-tickets"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>`);
 else html=html.replace('<!-- TURNSTILE_WIDGET -->','<p class="notify-hint">Ticket notification registration is not yet active.</p>').replace('id="notify-submit"','id="notify-submit" disabled');
 return view(html);
}
export default {async fetch(request,env){
  const u=new URL(request.url),path=u.pathname;
  try{
   if(path==='/tickets'||path==='/tickets/index.html')return Response.redirect(`${BASE}/tickets/`,308);
   if(path==='/tickets/'&&request.method==='GET')return ticketLanding(request,env);
   if(path==='/tickets/api/subscribe'&&request.method==='POST')return subscribe(request,env);
   if(path==='/tickets/verify'&&request.method==='GET')return verify(u.searchParams.get('token'),env);
   if(path==='/tickets/unsubscribe'&&request.method==='GET')return unsubscribeForm(u.searchParams.get('token'),env);
   if(path==='/tickets/api/unsubscribe'&&request.method==='POST'){
    const f=await request.formData();const removed=await processUnsubscribe(f.get('token'),env);
    return statePage({env,mode:removed?'unsubscribed':'unsubscribe',title:removed?'You are unsubscribed.':'Link unavailable',icon:removed?'✓':'!',body:removed?'You will no longer receive INFUSED ticket notifications.':'The unsubscribe link is invalid or was already used.',status:removed?200:400});
   }
   if(path==='/tickets/unsubscribe/one-click')return oneClick(request,env,u.searchParams.get('token'));
   if(['/tickets/verified/','/tickets/unsubscribed/'].includes(path))return Response.redirect(`${BASE}/tickets/`,302);
   if(path.startsWith('/tickets/')&&env.ASSETS)return env.ASSETS.fetch(request);
   return new Response('Not found',{status:404,headers:securityHeaders});
  }catch(error){console.error('INFUSED notification request failed',error?.message||'Unknown');return responseJson('The notification service is temporarily unavailable.',503);}
 }};
export {normalizeEmail,checkMx,checkTurnstile,digest};
