import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {webcrypto} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeSubmission,handleIntake,flushIntakeOutbox} from '../intake.mjs';

globalThis.crypto ??= webcrypto;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const BASE=process.env.SITE_BASE_PATH||'/dropjourneytest/';
const SITE_HOST=process.env.SITE_HOST||'infused.show';
const ENVIRONMENT=process.env.INTAKE_ENVIRONMENT||'preview';
const DIST=process.env.INFUSED_MODE==='production'?'production':'dropjourneytest';
const sql=await readFile(path.join(root,'migrations/0001_infused_native_intake.sql'),'utf8');
const store=new DatabaseSync(':memory:');
store.exec(sql);
const db={
 prepare(q){
  const st=store.prepare(q);
  let params=[];
  return{
   bind(...v){params=v;return this;},
   run(){const r=st.run(...params);return {meta:{changes:r.changes}};},
   first(){return st.get(...params)||null;},
   all(){return {results:st.all(...params)};}
  };
 },
 async batch(items){return items.map(x=>x.run());}
};
let gatewayCalls=0;
const env={
 INTAKE_DB:db,
 TURNSTILE_SECRET:'SYNTHETIC-UNIT-TEST-ONLY-NOT-A-REAL-SECRET',
 INTAKE_SES:{async sendRequest(){gatewayCalls++;return {status:'accepted',messageId:'mock-only-no-email-sent'};}},
 SITE_BASE_PATH:BASE,SITE_ALLOWED_HOSTS:SITE_HOST,INTAKE_ENVIRONMENT:ENVIRONMENT
};
const siteOK=async()=>new Response(JSON.stringify({success:true,hostname:SITE_HOST,action:'infused-intake'}),{status:200});
const siteWrongHost=async()=>new Response(JSON.stringify({success:true,hostname:'evil.example',action:'infused-intake'}),{status:200});
const siteWrongAction=async()=>new Response(JSON.stringify({success:true,hostname:SITE_HOST,action:'other'}),{status:200});
const siteFail=async()=>new Response(JSON.stringify({success:false}),{status:200});
const pathFor={buyer:BASE+'buyers/apply/',attendee:BASE+'tickets/',contact:BASE+'contact/'};
let serial=0;
function payload(kind,role,marketing=false){
 serial++;
 const id='00000000-0000-4000-8000-'+String(serial).padStart(12,'0');
 const base={
  kind,requestId:id,fullName:'Synthetic QA '+kind+' '+serial,
  email:'acceptance-'+serial+'@example.com',company:kind==='buyer'?'QA Synthetic Distributor':'',
  jobTitle:kind==='buyer'?'Category Manager':'',buyingRole:kind==='buyer'?role:'',
  attendeeRole:kind==='attendee'?role:'',
  categories:kind==='buyer'?['Functional beverages','Packaging / labeling']:kind==='attendee'?['General discovery']:[],
  objective:kind==='buyer'?'SYNTHETIC QA sourcing requirement only':'',
  message:kind==='contact'?'SYNTHETIC QA inquiry body only':'',
  website:'',markets:'',inquiryTopic:kind==='contact'?role:'',
  consentContact:true,consentMarketing:marketing,websiteConfirm:'',
  sourcePage:pathFor[kind],turnstileToken:'synthetic-token-for-mocked-siteverify'
 };
 return base;
}
const request=(body,{origin='https://'+SITE_HOST,contentType='application/json',method='POST'}={})=>
 new Request('https://'+SITE_HOST+BASE+'api/intake',{
  method,headers:{Origin:origin,'Content-Type':contentType},
  ...(method==='POST'?{body:JSON.stringify(body)}:{})
 });
const count=t=>store.prepare('SELECT COUNT(*) AS n FROM '+t).get().n;

const roles={
 buyer:['Purchasing decision-maker','Research / recommendations','Sourcing support','Other'],
 attendee:['General attendee / discovery','Industry buyer','Programming / community','Undecided'],
 contact:['Exhibiting','Sponsorship','Hosted buyers','Partnership','Media / speaking','General']
};
let successful=0,duplicates=0;
for(const [kind,options] of Object.entries(roles)){
 for(let i=0;i<options.length;i++){
  const p=payload(kind,options[i],i===options.length-1);
  const before=count('intake_submissions_v1');
  const result=await handleIntake(request(p),env,siteOK);
  assert.equal(result.status,200,kind+' '+options[i]+' must be accepted');
  const body=await result.json();
  assert.equal(body.ok,true);
  const row=store.prepare('SELECT * FROM intake_submissions_v1 WHERE request_key=?').get(p.requestId);
  assert.ok(row,'D1 mock readback must find request');
  assert.equal(row.id,body.receiptId);
  assert.equal(row.kind,kind);
  assert.equal(row.consent_marketing,p.consentMarketing?1:0,'marketing consent must be independent');
  assert.equal(row.source_page,pathFor[kind]);
  assert.equal(row.environment,ENVIRONMENT,'preview/canary submissions must remain preview; production submits must be explicit');
  assert.equal(row.buying_role,kind==='contact'?'':options[i]);
  assert.deepEqual(JSON.parse(row.categories_json),p.categories);
  assert.equal(count('intake_submissions_v1'),before+1);
  assert.equal(store.prepare('SELECT COUNT(*) n FROM intake_notification_outbox_v1 WHERE submission_id=?').get(row.id).n,1);
  successful++;
  // Idempotent replay: the same request key must return the existing receipt.
  const again=await handleIntake(request(p),env,siteOK);
  assert.equal(again.status,200);
  assert.equal((await again.json()).receiptId,body.receiptId);
  assert.equal(count('intake_submissions_v1'),before+1);
  assert.equal(store.prepare('SELECT COUNT(*) n FROM intake_notification_outbox_v1 WHERE submission_id=?').get(row.id).n,1);
  duplicates++;
 }
}

const negative=payload('buyer','Purchasing decision-maker');
const bad=[
 ['no required inquiry consent',{...negative,consentContact:false},400,siteOK],
 ['marketing choice must be explicit',{...negative,consentMarketing:null},400,siteOK],
 ['invalid email',{...negative,email:'not-an-email'},400,siteOK],
 ['no company',{...negative,company:''},400,siteOK],
 ['missing sourcing category',{...negative,categories:[]},400,siteOK],
 ['unknown sourcing category',{...negative,categories:['UNKNOWN']},400,siteOK],
 ['invalid buying authority',{...negative,buyingRole:'Other Person'},400,siteOK],
 ['missing sourcing objective',{...negative,objective:''},400,siteOK],
 ['honeypot filled',{...negative,websiteConfirm:'automated-bot'},400,siteOK],
 ['non-https website',{...negative,website:'http://example.com'},400,siteOK],
 ['invalid request receipt',{...negative,requestId:'not-a-uuid'},400,siteOK],
 ['bad source page',{...negative,sourcePage:'https://evil.example'},400,siteOK],
 ['overly long objective',{...negative,objective:'x'.repeat(1501)},400,siteOK],
 ['Turnstile wrong hostname',negative,403,siteWrongHost],
 ['Turnstile wrong action',negative,403,siteWrongAction],
 ['Turnstile rejected',negative,403,siteFail]
];
let rejected=0;
for(const [label,p,status,verifier] of bad){
 const before=count('intake_submissions_v1');
 const res=await handleIntake(request(p),env,verifier);
 assert.equal(res.status,status,label);
 assert.equal(count('intake_submissions_v1'),before,'rejected request must not reach D1');
 rejected++;
}
for(const [label,p] of [
 ['invalid attendee role',{...payload('attendee','Undecided'),attendeeRole:'invalid role'}],
 ['missing contact topic',{...payload('contact','General'),inquiryTopic:''}],
 ['missing contact message',{...payload('contact','General'),message:''}]
]){
 const res=await handleIntake(request(p),env,siteOK);
 assert.equal(res.status,400,label);
 rejected++;
}
const before=count('intake_submissions_v1');
const method=await handleIntake(request({}, {method:'GET'}),env,siteOK);
assert.equal(method.status,405);rejected++;
const origin=await handleIntake(request(negative,{origin:'https://unauthorized.example'}),env,siteOK);
assert.equal(origin.status,403);rejected++;
const type=await handleIntake(request(negative,{contentType:'text/plain'}),env,siteOK);
assert.equal(type.status,403);rejected++;
const disabled=await handleIntake(request(negative),{...env,INTAKE_SES:null},siteOK);
assert.equal(disabled.status,503);rejected++;
const huge=await handleIntake(request({...negative,additional:'x'.repeat(17000)}),env,siteOK);
assert.equal(huge.status,400);rejected++;
assert.equal(count('intake_submissions_v1'),before,'protocol and size rejections must not write');
assert.equal(count('intake_notification_outbox_v1'),successful,'one outbox row for each valid submission');

// SES bridge is separately production-tested; this is a same-interface fake,
// not evidence that real SES sent anything.
const unnotified=payload('attendee','Industry buyer');
const failedEnv={...env,INTAKE_SES:{async sendRequest(){throw Error('synthetic transport outage')}}};
const duringOutage=await handleIntake(request(unnotified),failedEnv,siteOK);
assert.equal(duringOutage.status,200,'Save should succeed even if notification transport is down');
const receipt=(await duringOutage.json()).receiptId;
assert.equal(store.prepare('SELECT state FROM intake_notification_outbox_v1 WHERE submission_id=?').get(receipt).state,'pending');
const flush=await flushIntakeOutbox(env);
assert.ok(flush.attempted>0,'Pending outbox must be eligible for scheduled retry');
assert.ok(flush.accepted>0,'Mock transport should report accepted');
assert.equal(store.prepare('SELECT COUNT(*) n FROM intake_submissions_v1 WHERE id=?').get(receipt).n,1);

const pages=['buyers/apply','contact'];
for(const id of pages){
 const html=await readFile(path.join(root,'dist',DIST,id,'index.html'),'utf8');
 assert.match(html,/cf-turnstile/);
 assert.match(html,/class="dj-intake-form"/);
 assert.ok(html.includes('action="'+BASE+'api/intake"'),'form action must match selected build base');
 assert.doesNotMatch(html,/jotform/i);
}
assert.equal(successful,14);
assert.equal(duplicates,14);
assert.ok(rejected>=24);
console.log('PASS DJ-U3 acceptance matrix: '+successful+' valid role variants; '+duplicates+' idempotent replays; '+rejected+' rejected conditions; 1 simulated SES-outage persistence/recovery; 3 native pages');
