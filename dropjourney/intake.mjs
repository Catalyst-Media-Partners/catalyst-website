// INFUSED native intake: isolated D1 persistence and private SES service binding.
export const INTAKE_PATH='/dropjourneytest/api/intake';
const ALLOWED_CATEGORIES=new Set(['Finished infused products','Functional beverages','Hemp-derived products','Ingredients / formulation','Contract manufacturing / co-packing','Packaging / labeling','Distribution / wholesale','Retail solutions','General discovery','Other']);
const BUYING_ROLES=new Set(['Purchasing decision-maker','Research / recommendations','Sourcing support','Other']);
const ATTENDEE_ROLES=new Set(['General attendee / discovery','Industry buyer','Programming / community','Undecided']);
const TOPICS=new Set(['Exhibiting','Sponsorship','Hosted buyers','Partnership','Media / speaking','General']);
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow, noarchive','Referrer-Policy':'no-referrer'}});
class InputError extends Error{}
const value=(v,label,max,required=false)=>{
 if(typeof v!=='string')throw new InputError('Invalid '+label);
 const s=v.trim();
 if((required&&!s)||s.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))throw new InputError('Invalid '+label);
 return s;
};
const option=(v,allowed,label,required=false)=>{if(!v&&!required)return '';const s=value(v,label,100,required);if(!allowed.has(s))throw new InputError('Invalid '+label);return s;};
export function normalizeSubmission(b){
 if(!b||typeof b!=='object'||Array.isArray(b))throw new InputError('Invalid submission');
 const kind=value(b.kind,'request type',30,true);
 if(!['buyer','attendee','contact'].includes(kind))throw new InputError('Unknown request type');
 const requestKey=value(b.requestId,'request receipt',40,true);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestKey))throw new InputError('Invalid receipt');
 const fullName=value(b.fullName,'name',120,true),email=value(b.email,'email',254,true).toLowerCase();
 if(!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)||email.includes('..'))throw new InputError('Invalid email');
 if(b.consentContact!==true)throw new InputError('Please agree to contact about this inquiry');
 if(typeof b.consentMarketing!=='boolean')throw new InputError('Invalid marketing choice');
 const company=value(b.company??'','company',150,kind==='buyer');
 const jobTitle=value(b.jobTitle??'','job title',120);
 const categories=b.categories??[];
 if(!Array.isArray(categories)||categories.length>8||categories.some(x=>typeof x!=='string'||!ALLOWED_CATEGORIES.has(x)))throw new InputError('Invalid categories');
 const selected=[...new Set(categories)];
 if(kind==='buyer'&&!selected.length)throw new InputError('Please choose at least one category');
 const objective=value(b.objective??'','objective',1500,kind==='buyer');
 const message=value(b.message??'','message',2000,kind==='contact');
 const buyingRole=kind==='buyer'?option(b.buyingRole,BUYING_ROLES,'purchasing role',true):kind==='attendee'?option(b.attendeeRole,ATTENDEE_ROLES,'attendance role',true):'';
 const inquiryTopic=kind==='contact'?option(b.inquiryTopic,TOPICS,'inquiry topic',true):'';
 const website=value(b.website??'','website',240);
 if(website&&!/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+(?:\/[^\s]*)?$/i.test(website))throw new InputError('Invalid website');
 const markets=value(b.markets??'','markets',200);
 const sourcePage=value(b.sourcePage??'','source page',190,true);
 if(!sourcePage.startsWith('/dropjourneytest/')||sourcePage.includes('?')||sourcePage.includes('://'))throw new InputError('Invalid source page');
 if(typeof b.websiteConfirm==='string'&&b.websiteConfirm.trim())throw new InputError('Could not verify request');
 return {kind,requestKey,fullName,email,company,jobTitle,buyingRole,categories:selected,objective,website,markets,message,inquiryTopic,consentMarketing:b.consentMarketing,sourcePage};
}
async function readBounded(req,max=16000){
 if(Number(req.headers.get('Content-Length')||0)>max)throw new InputError('Request too large');
 const reader=req.body?.getReader();if(!reader)throw new InputError('Missing body');
 let n=0;const chunks=[];
 while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw new InputError('Request too large');}chunks.push(value);}
 const buf=new Uint8Array(n);let at=0;for(const v of chunks){buf.set(v,at);at+=v.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buf));}catch{throw new InputError('Invalid JSON');}
}
async function siteVerify(token,req,env,fetcher=fetch){
 if(!env.TURNSTILE_SECRET||typeof token!=='string'||token.length<10||token.length>2048)return false;
 const body=new URLSearchParams({secret:env.TURNSTILE_SECRET,response:token});
 const ip=req.headers.get('CF-Connecting-IP');if(ip)body.set('remoteip',ip);
 try{
  const r=await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body,signal:AbortSignal.timeout(8000)});
  if(!r.ok)return false;
  const proof=await r.json();
  return proof.success===true&&proof.hostname==='infused.show'&&(!proof.action||proof.action==='infused-intake');
 }catch{return false;}
}
export async function handleIntake(req,env,fetcher=fetch){
 if(req.method!=='POST')return json({error:'Method not allowed'},405);
 if(req.headers.get('Origin')!=='https://infused.show'||!/^application\/json(?:\s*;|$)/i.test(req.headers.get('Content-Type')||''))return json({error:'Invalid origin or content type'},403);
 if(!env.INTAKE_DB||!env.TURNSTILE_SECRET||!env.INTAKE_SES)return json({error:'Intake temporarily unavailable'},503);
 let body,p;
 try{body=await readBounded(req);p=normalizeSubmission(body);}catch(e){return json({error:e instanceof InputError?e.message:'Invalid request'},400);}
 if(!await siteVerify(body.turnstileToken,req,env,fetcher))return json({error:'Human verification failed'},403);
 try{
  const id=crypto.randomUUID();
  const insert='INSERT INTO intake_submissions_v1 (id,request_key,kind,full_name,email,company,job_title,buying_role,categories_json,objective,website,markets,message,inquiry_topic,consent_contact,consent_marketing,consent_version,source_page,environment) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(request_key) DO NOTHING';
  const outbox='INSERT INTO intake_notification_outbox_v1(submission_id) SELECT id FROM intake_submissions_v1 WHERE request_key=? ON CONFLICT(submission_id) DO NOTHING';
  await env.INTAKE_DB.batch([
   env.INTAKE_DB.prepare(insert).bind(id,p.requestKey,p.kind,p.fullName,p.email,p.company,p.jobTitle,p.buyingRole,JSON.stringify(p.categories),p.objective,p.website,p.markets,p.message,p.inquiryTopic,1,p.consentMarketing?1:0,'infused-intake-2026-10-28-v1',p.sourcePage,'preview'),
   env.INTAKE_DB.prepare(outbox).bind(p.requestKey)
  ]);
  const row=await env.INTAKE_DB.prepare('SELECT id,kind FROM intake_submissions_v1 WHERE request_key=?').bind(p.requestKey).first();
  if(!row||row.kind!==p.kind)throw Error('Persist mismatch');
  let notification='queued';
  try{const r=await env.INTAKE_SES.sendRequest({id:row.id});notification=r?.status||'queued';}catch(e){console.error('INFUSED notification relay error',e?.name||'Error');}
  return json({ok:true,receiptId:row.id,notification});
 }catch(e){console.error('INFUSED intake persistence error',e?.name||'Error');return json({error:'Submission could not be stored. Please retry.'},503);}
}
export async function flushIntakeOutbox(env){
 if(!env.INTAKE_DB||!env.INTAKE_SES)return {status:'unconfigured'};
 const q=await env.INTAKE_DB.prepare("SELECT submission_id FROM intake_notification_outbox_v1 WHERE state IN ('pending','retry') AND next_attempt_at<=datetime('now') ORDER BY created_at LIMIT 10").all();
 let accepted=0;for(const row of q.results||[]){try{const r=await env.INTAKE_SES.sendRequest({id:row.submission_id});if(r?.status==='accepted')accepted++;}catch{}}
 return {attempted:(q.results||[]).length,accepted};
}
