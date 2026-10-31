/** Lightweight, verified INFUSED ticket notifications.
 * This flow remains disabled until its separate production acceptance.
 * SES credentials stay in the existing private Catalyst revenue bridge.
 */
export const TICKET_PREFIX='/dropjourneytest/tickets';
const VERIFY_LIFETIME_MS=7*86400000;
const EMAIL=/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/;
const TOKEN=/^[0-9a-f]{64}$/;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rand=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
const json=(o,status=200)=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer'}});
const secure={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex,nofollow,noarchive','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
const basePath=env=>{
 const value=typeof env?.SITE_BASE_PATH==='string'?env.SITE_BASE_PATH:'/dropjourneytest/';
 if(!value.startsWith('/')||!value.endsWith('/')||value.includes('..')||value.includes('?'))throw new Error('Invalid site base path');
 return value;
};
export const ticketPrefix=env=>basePath(env)==='/'?'/tickets':basePath(env).replace(/\/$/,'')+'/tickets';
const allowedHosts=env=>(env?.SITE_ALLOWED_HOSTS||'infused.show').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const html=(title,message,{code='',action='',token='',status=200}={},prefix=TICKET_PREFIX)=>{
 const t=esc(title),msg=esc(message),validCode=/^INF25-[A-F0-9]{12}$/.test(code)?code:'';
 const base=prefix.replace(/tickets$/,'');
 const button=action==='unsubscribe'?'<form action="'+prefix+'/api/unsubscribe" method="POST"><input type="hidden" name="token" value="'+esc(token)+'"><button type="submit">Confirm unsubscribe</button></form>':'';
 const claim=validCode?'<div class="code"><span>Your 25% early-bird code</span><strong>'+validCode+'</strong><p>Save this code. Ticket checkout is not yet open; the discount becomes usable only after the offer is activated in ticket checkout.</p></div>':'';
 return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>'+t+' | INFUSED</title><style>body{background:#121016;color:#f3f0f4;margin:0;font:16px/1.65 system-ui,Arial,sans-serif}main{max-width:600px;margin:8vh auto;padding:24px}img{width:260px;max-width:100%;height:auto}h1{font-size:clamp(32px,6vw,54px);line-height:1.05;letter-spacing:-.04em}p{color:#c9c3d0}a{color:#c9f18b}.code{padding:25px;border:1px solid #acd976;border-radius:12px;background:#24232a}.code span{display:block;font-size:13px;color:#b9ea80}.code strong{font-size:clamp(25px,6vw,39px);color:#fff;letter-spacing:.08em;overflow-wrap:anywhere}.code p{font-size:13px;margin-bottom:0}button{border:0;background:#b9ed83;border-radius:6px;padding:14px 22px;font-weight:800;cursor:pointer}</style></head><body><main><a href="'+base+'"><img src="'+base+'assets/images/infused-wordmark-shaded-web-hd.png" alt="INFUSED"></a><h1>'+t+'</h1><p>'+msg+'</p>'+claim+button+'<p><a href="'+prefix+'/">Back to ticket updates</a></p></main></body></html>',{status,headers:secure});
};
const validEmail=s=>{if(typeof s!=='string')return null;const email=s.trim().toLowerCase();if(email.length>254||!EMAIL.test(email))return null;const [local,domain]=email.split('@');if(local.length>64||local.includes('..')||local.startsWith('.')||local.endsWith('.')||domain.split('.').some(s=>s.length>63||s.startsWith('-')||s.endsWith('-')))return null;return {email,domain};};
async function verifyCaptcha(token,request,env,fetcher=fetch){
 if(!env.TURNSTILE_SECRET||typeof token!=='string'||token.length<10||token.length>2048)return false;
 const host=new URL(request.url).hostname.toLowerCase();
 if(!allowedHosts(env).includes(host))return false;
 try{const r=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token}),signal:AbortSignal.timeout(7000)});
  if(!r.ok)return false;const v=await r.json();return v.success===true&&v.hostname===host&&v.action==='infused-tickets';}catch{return false;}
}
async function mxOk(domain,fetcher=fetch){
 try{const r=await fetcher('https://cloudflare-dns.com/dns-query?name='+encodeURIComponent(domain)+'&type=MX',{headers:{Accept:'application/dns-json'},signal:AbortSignal.timeout(5000)});if(!r.ok)return null;
 const obj=await r.json();if(obj.Status===3)return false;if(obj.Status!==0)return null;
 return (obj.Answer||[]).some(a=>a.type===15&&typeof a.data==='string'&&!/^0\s+\.$/.test(a.data.trim()));}catch{return null;}
}
const ready=env=>env?.TICKET_NOTIFY_ENABLED==='true'&&!!env.INTAKE_DB&&!!env.TURNSTILE_SECRET&&typeof env.INTAKE_SES?.sendTicketVerification==='function';
async function subscribe(request,env,fetcher,prefix=TICKET_PREFIX){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const requestUrl=new URL(request.url),host=requestUrl.hostname.toLowerCase();
 if(requestUrl.protocol!=='https:'||!allowedHosts(env).includes(host)||request.headers.get('Origin')!==requestUrl.origin||!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type')||''))return json({error:'Request origin not allowed'},403);
 if(!ready(env))return json({error:'Ticket notifications are not yet active.'},503);
 let data;try{const raw=await request.text();if(raw.length>2048)throw Error('size');data=JSON.parse(raw);}catch{return json({error:'Invalid request'},400);}
 const norm=validEmail(data?.email);if(!norm)return json({error:'Enter a valid email address.'},400);
 if(!await verifyCaptcha(data?.turnstile,request,env,fetcher))return json({error:'Complete the human verification.'},403);
 const ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({error:'Request could not be verified.'},400);
 const db=env.INTAKE_DB,now=new Date(),stamp=now.toISOString();
 const ipHash=await hash(env.TURNSTILE_SECRET+':'+ip),hour=Math.floor(now.getTime()/3600000);
 try{
  const rate=await db.prepare("INSERT INTO infused_ticket_notify_rate_v1(key_hash,hour_bucket,attempts) VALUES(?,?,1) ON CONFLICT(key_hash,hour_bucket) DO UPDATE SET attempts=attempts+1 RETURNING attempts").bind(ipHash,hour).first();
  if(rate.attempts>8)return json({error:'Too many requests. Try again later.'},429);
  const existing=await db.prepare('SELECT id,state,mail_state,mail_sent_at FROM infused_ticket_notify_v1 WHERE email=?').bind(norm.email).first();
  if(existing?.state==='verified'||existing?.state==='pending'&&['sent','uncertain','sending'].includes(existing.mail_state)&&(!existing.mail_sent_at||now.getTime()-Date.parse(existing.mail_sent_at)<3600000))return json({ok:true,message:'If this address is eligible, check your inbox for a verification email.'});
  const dns=await mxOk(norm.domain,fetcher);
  if(dns===null)return json({error:'Email domain verification is temporarily unavailable. Please retry.'},503);
  if(!dns)return json({error:'This email domain does not appear able to receive messages.'},400);
  const id=crypto.randomUUID(),token=rand(),unsub=rand(),expires=new Date(now.getTime()+VERIFY_LIFETIME_MS).toISOString();
  const verifyHash=await hash(token),unsubHash=await hash(unsub);
  if(existing){
   await db.prepare("UPDATE infused_ticket_notify_v1 SET id=?,state='pending',verification_hash=?,verify_expires_at=?,unsubscribe_hash=?,mail_state='queued',mail_attempts=0,mail_sent_at=NULL,ses_message_id=NULL,promo_code=NULL,verified_at=NULL,unsubscribed_at=NULL WHERE email=?").bind(id,verifyHash,expires,unsubHash,norm.email).run();
  }else{
   await db.prepare("INSERT INTO infused_ticket_notify_v1(id,email,email_domain,state,verification_hash,verify_expires_at,unsubscribe_hash,mail_state,created_at) VALUES(?,?,?,'pending',?,?,?,'queued',?)").bind(id,norm.email,norm.domain,verifyHash,expires,unsubHash,stamp).run();
  }
  // Credentialless worker RPC: SES recipient is verified against D1 by the trusted relay.
  const reply=await env.INTAKE_SES.sendTicketVerification({id,verifyToken:token,unsubscribeToken:unsub});
  if(reply?.status!=='accepted'&&reply?.status!=='already_sent')return json({error:'We could not confirm the email delivery. Please try again later.'},503);
  return json({ok:true,message:'Check your inbox. Click the verification link to unlock your 25% early-bird access code.'});
 }catch(e){console.error('INFUSED ticket notify failed',e?.name||'Error');return json({error:'Ticket notifications are temporarily unavailable.'},503);}
}
async function verify(request,env,prefix=TICKET_PREFIX){
 if(!env.INTAKE_DB)return html('Verification unavailable','Please try again later.',{status:503},prefix);
 const token=new URL(request.url).searchParams.get('token')||'';
 if(!TOKEN.test(token))return html('Invalid verification link','Please request a new email from the ticket page.',{status:400},prefix);
 const digest=await hash(token),row=await env.INTAKE_DB.prepare("SELECT id,email,verify_expires_at FROM infused_ticket_notify_v1 WHERE verification_hash=? AND state='pending'").bind(digest).first();
 if(!row||Date.parse(row.verify_expires_at)<=Date.now())return html('Link expired or used','Return to tickets and request another verification link.',{status:400},prefix);
 const code='INF25-'+Array.from(crypto.getRandomValues(new Uint8Array(6)),x=>x.toString(16).padStart(2,'0').toUpperCase()).join('');
 const result=await env.INTAKE_DB.prepare("UPDATE infused_ticket_notify_v1 SET state='verified',verified_at=?,promo_code=?,verification_hash=NULL,verify_expires_at=NULL WHERE id=? AND state='pending' AND verification_hash=?").bind(new Date().toISOString(),code,row.id,digest).run();
 if(!result.meta?.changes)return html('Link already used','Your ticket notification registration may already be verified.',{status:400},prefix);
 return html('Email verified. Your early-bird code is ready.','Your 25% INFUSED early-bird offer is reserved. This is not a ticket or a completed purchase.',{code},prefix);
}
async function unsubscribe(request,env,prefix=TICKET_PREFIX){
 if(!env.INTAKE_DB)return html('Unsubscribe unavailable','Please try again later.',{status:503},prefix);
 let token='';if(request.method==='GET')token=new URL(request.url).searchParams.get('token')||'';else if(request.method==='POST'){if(!/^application\/x-www-form-urlencoded/.test(request.headers.get('Content-Type')||''))return html('Invalid request','Please use the unsubscribe link in your email.',{status:400},prefix);const raw=await request.text();if(raw.length>600)return html('Invalid link','Please try again.',{status:400},prefix);token=new URLSearchParams(raw).get('token')||'';}else return new Response('Method not allowed',{status:405});
 if(!TOKEN.test(token))return html('Invalid unsubscribe link','Please return to the ticket page.',{status:400},prefix);
 if(request.method==='GET')return html('Stop INFUSED ticket emails?','You can unsubscribe from future ticket notices.',{action:'unsubscribe',token},prefix);
 const result=await env.INTAKE_DB.prepare("UPDATE infused_ticket_notify_v1 SET state='unsubscribed',unsubscribed_at=?,verification_hash=NULL,verify_expires_at=NULL WHERE unsubscribe_hash=? AND state!='unsubscribed'").bind(new Date().toISOString(),await hash(token)).run();
 return result.meta?.changes?html('You are unsubscribed','INFUSED will not send further ticket notifications to this subscription.'):html('Link unavailable','This link is invalid or was already used.',{status:400},prefix);
}
export async function handleTicketRequest(request,env,fetcher=fetch){
 const u=new URL(request.url),prefix=ticketPrefix(env);
 if(u.pathname===prefix+'/api/status')return json({enabled:ready(env)});
 if(u.pathname===prefix+'/api/subscribe')return subscribe(request,env,fetcher,prefix);
 if(u.pathname===prefix+'/verify'&&request.method==='GET')return verify(request,env,prefix);
 if(u.pathname===prefix+'/unsubscribe'&&request.method==='GET')return unsubscribe(request,env,prefix);
 if(u.pathname===prefix+'/api/unsubscribe')return unsubscribe(request,env,prefix);
 return new Response('Not found',{status:404,headers:{'X-Robots-Tag':'noindex'}});
}
export {validEmail,verifyCaptcha,subscribe,verify,unsubscribe};
