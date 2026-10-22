import test from 'node:test';import assert from 'node:assert/strict';
import worker from '../src/worker.mjs';
import {normalizeEmail} from '../src/tickets/notifications.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {confirmationEmail,SENDER} from '../src/tickets/email.mjs';

class DB {
 constructor(){this.people=new Map();this.rates=new Map();}
 prepare(sql){const db=this;return {bind(...b){return {
  async first(){
   if(sql.startsWith('INSERT INTO ticket_notify_rate')){const k=b.join('::'),n=(db.rates.get(k)||0)+1;db.rates.set(k,n);return{attempts:n};}
   if(sql.startsWith('SELECT email FROM ticket_notify_subscribers LIMIT 1'))return null;
   if(sql.includes('SELECT state, verification_sent_at')){const p=db.people.get(b[0]);return p?{state:p.state,verification_sent_at:p.verification_sent_at}:null;}
   if(sql.includes('SELECT email FROM ticket_notify_subscribers')){const p=[...db.people.values()].find(x=>x.verification_hash===b[0]&&x.verification_expires_at>b[1]&&x.state==='pending');return p?{email:p.email}:null;}
   throw Error('Unknown first query: '+sql);
  },
  async run(){
   if(sql.startsWith('INSERT INTO ticket_notify_subscribers')){
    const[email,domain,hash,expires,unsub,now]=b;const existing=db.people.get(email);
    if(existing?.state==='verified')return{meta:{changes:0}};
    db.people.set(email,{email,email_domain:domain,state:'pending',verification_hash:hash,verification_expires_at:expires,unsubscribe_hash:unsub,created_at:existing?.created_at||now,verification_sent_at:null,verified_at:null,unsubscribed_at:null});return{meta:{changes:1}};
   }
   if(sql.includes('SET verification_sent_at=?')){const p=db.people.get(b[1]);if(p?.verification_hash===b[2]){p.verification_sent_at=b[0];return{meta:{changes:1}};}return{meta:{changes:0}};}
   if(sql.includes("SET state='verified'")){const p=db.people.get(b[1]);if(p?.verification_hash===b[2]&&p.state==='pending'){p.state='verified';p.verified_at=b[0];p.verification_hash=null;p.verification_expires_at=null;return{meta:{changes:1}};}return{meta:{changes:0}};}
   if(sql.includes("SET state='unsubscribed'")){const p=[...db.people.values()].find(x=>x.unsubscribe_hash===b[1]);if(p){p.state='unsubscribed';p.unsubscribed_at=b[0];p.verification_hash=null;p.verification_expires_at=null;return{meta:{changes:1}};}return{meta:{changes:0}};}
   throw Error('Unknown run query: '+sql);
  }
 };}};}
}
const env={ASSETS:{fetch:async request=>{const url=new URL(request.url);let route=url.pathname; if(route.endsWith('/'))route+='index.html';if(route==='/')route='/index.html';const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public','.'+route);const html=readFileSync(file,'utf8');return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=utf-8'}});}},DB:new DB(),IS_PRODUCTION:true,INFUSED_NOTIFY_ENABLED:'true',SITE_ORIGIN:'https://infused.show',TURNSTILE_SITE_KEY:'00000000000000000000000',TURNSTILE_SECRET_KEY:'test-secret',RATE_SALT:'testing-only-not-a-real-secret',MAILING_ADDRESS:'123 Fictional Test Street, Test City, ZZ 00000',AWS_SES_REGION:'us-west-2',AWS_SES_ACCESS_KEY_ID:'FAKE_ACCESS_KEY',AWS_SES_SECRET_ACCESS_KEY:'FAKE_SECRET_KEY'};
env.AUDIENCE_DB=env.DB;
const sent=[];const originalFetch=globalThis.fetch;
globalThis.fetch=async(input,options={})=>{const u=String(input);
 if(u.includes('dns-query')){if(u.includes('bad.invalid'))return new Response(JSON.stringify({Status:3}),{status:200});if(u.includes('nodomain.test'))return new Response(JSON.stringify({Status:0,Answer:[]}),{status:200});return new Response(JSON.stringify({Status:0,Answer:[{type:15,data:'10 mx1.example.com.'}]}),{status:200});}
 if(u.includes('turnstile/v0/siteverify'))return new Response(JSON.stringify({success:true,hostname:'infused.show'}),{status:200});
 if(u.includes('amazonaws.com/v2/email/outbound-emails')){assert.match(options.headers.get('Authorization'),/AWS4-HMAC-SHA256 Credential=FAKE_ACCESS_KEY\//);const raw=JSON.parse(options.body);sent.push(raw);return new Response(JSON.stringify({MessageId:'test'}),{status:200});}
 throw Error('Unexpected fetch in test: '+u);
};
function subscribe(email,ip='203.0.113.11'){return worker.fetch(new Request('https://infused.show/tickets/api/subscribe',{method:'POST',headers:{'Content-Type':'application/json','Origin':'https://infused.show','CF-Connecting-IP':ip},body:JSON.stringify({email,turnstile:'test-token'})}),env);}
function tokenFromHtml(html,type){const re=type==='verify'?/https:\/\/infused\.show\/tickets\/verify\?token=([a-f0-9]{64})/:/https:\/\/infused\.show\/tickets\/unsubscribe\?token=([a-f0-9]{64})/;return html.match(re)?.[1];}

test('validation, opt-in, verify, unsubscribe, and secure mail metadata',async t=>{
 await t.test('email validation and MX checking',async()=>{
  assert.equal(normalizeEmail('not_an_address'),null);assert.equal(normalizeEmail('user@invalid..com'),null);
  assert.equal(normalizeEmail('Name+Info@Example.COM').email,'name+info@example.com');
  let res=await subscribe('fake@bad.invalid');assert.equal(res.status,400);
  res=await subscribe('fake@nodomain.test');assert.equal(res.status,400);
 });
 await t.test('request sends one branded verification email and tracks pending',async()=>{
  const res=await subscribe('First+Guest@Example.com');assert.equal(res.status,200);assert.match((await res.json()).message,/Check your inbox/i);
  assert.equal(sent.length,1);const mail=sent[0];assert.equal(mail.Destination.ToAddresses[0],'first+guest@example.com');assert.equal(mail.FromEmailAddress,SENDER);
  assert.match(mail.Content.Simple.Subject.Data,/Verify your email/);assert.match(mail.Content.Simple.Body.Html.Data,/25% off early-bird tickets/);
  assert.ok(mail.Content.Simple.Headers.some(h=>h.Name==='List-Unsubscribe-Post'));
  assert.equal(env.DB.people.get('first+guest@example.com').state,'pending');
 });
 await t.test('repeat submissions do not spam and verification cannot be reused',async()=>{
  let res=await subscribe('first+guest@example.com');assert.equal(res.status,200);assert.equal(sent.length,1);
  const code=tokenFromHtml(sent[0].Content.Simple.Body.Html.Data,'verify');assert.ok(code);const url='https://infused.show/tickets/verify?token='+code;
  res=await worker.fetch(new Request(url),env);assert.equal(res.status,200);const successHtml=await res.text();assert.match(successHtml,/YOU'RE VERIFIED/i);assert.doesNotMatch(successHtml,/<div class=\"hero-promise\">FROM ROOTS TO RETAIL<\/div>/);assert.match(successHtml,/assets\/css\/site.css/);assert.match(successHtml,/src=\"\.\.\/\.\.\/assets\/images\/infused-logo-00.webp/);
  assert.equal(env.DB.people.get('first+guest@example.com').state,'verified');
  res=await worker.fetch(new Request(url),env);assert.equal(res.status,400);
  res=await subscribe('first+guest@example.com');assert.equal(res.status,200);assert.equal(sent.length,1);
 });
 await t.test('manual unsubscribe requires confirmation; one-click POST works',async()=>{
  const unsub=tokenFromHtml(sent[0].Content.Simple.Body.Html.Data,'unsubscribe');assert.ok(unsub);
  const url='https://infused.show/tickets/unsubscribe?token='+unsub;
  let res=await worker.fetch(new Request(url),env);assert.equal(res.status,200);const unsubscribeHtml=await res.text();assert.match(unsubscribeHtml,/Unsubscribe/i);assert.match(unsubscribeHtml,/assets\/css\/site.css/);
  assert.equal(env.DB.people.get('first+guest@example.com').state,'verified');
  res=await worker.fetch(new Request('https://infused.show/tickets/unsubscribe/one-click?token='+unsub),env);assert.equal(res.status,405);
  res=await worker.fetch(new Request('https://infused.show/tickets/unsubscribe/one-click?token='+unsub,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'}),env);
  assert.equal(res.status,200);assert.equal(env.DB.people.get('first+guest@example.com').state,'unsubscribed');
 });
 await t.test('origin guard and local throttling',async()=>{
  const reject=await worker.fetch(new Request('https://infused.show/tickets/api/subscribe',{method:'POST',headers:{Origin:'https://evil.invalid','CF-Connecting-IP':'203.0.113.17'},body:'{}'}),env);assert.equal(reject.status,403);
  let outcome;for(let i=0;i<10;i++)outcome=await subscribe(`person${i}@example.com`,'198.51.100.15');assert.equal(outcome.status,429);
 });
 await t.test('unconfigured and preview environments cannot collect addresses or send email',async()=>{
  const previous=env.INFUSED_NOTIFY_ENABLED,initial=sent.length;
  env.INFUSED_NOTIFY_ENABLED='false';
  let res=await subscribe('disabled@example.com','203.0.113.99');assert.equal(res.status,503);
  res=await worker.fetch(new Request('https://infused.show/tickets/'),env);
  assert.equal(res.status,200);assert.match(await res.text(),/id="notify-submit" disabled/);
  env.INFUSED_NOTIFY_ENABLED=previous;
  res=await worker.fetch(new Request('https://infused-show.example.workers.dev/tickets/api/subscribe',{method:'POST',headers:{Origin:'https://infused.show','CF-Connecting-IP':'203.0.113.99'},body:JSON.stringify({email:'preview@example.com',turnstile:'test-token'})}),env);
  assert.equal(res.status,503);assert.equal(sent.length,initial);
 });
 await t.test('verification template is safe HTML with plain-text alternative',()=>{ 
  const x=confirmationEmail({verifyUrl:'https://infused.show/tickets/verify?token=foo',unsubscribeUrl:'https://infused.show/tickets/unsubscribe?token=bar'});
  assert.match(x.text,/verify/);assert.match(x.html,/VERIFY EMAIL/);assert.match(x.html,/Unsubscribe/);
 });
 globalThis.fetch=originalFetch;
});
