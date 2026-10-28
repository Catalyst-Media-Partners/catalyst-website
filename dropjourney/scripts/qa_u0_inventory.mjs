import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');
const pages=['','market','ecosystem','roots','science','make','package','move','sell','services','buyers','why-vegas','opportunities','contact','tickets','buyers/apply'];
const landers=['','discover','exhibit','buyers','sponsor','attend'];
const records=[];
const publicOrigin='https://infused.show';
const simplify=s=>s.replace(/<[^>]+>/g,' ').replace(/&(?:amp|#38);/g,'&').replace(/\s+/g,' ').trim();
for(const id of pages){
 const pathId=id?encodeURI(id)+'/':'';
 const html=await read('dist/dropjourneytest/'+pathId+'index.html');
 const labels=[...html.matchAll(/<a\b[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(m=>({url:m[1].replaceAll('&amp;','&'),label:simplify(m[2]).slice(0,110)}));
 const buttons=[...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m=>simplify(m[1]).slice(0,90));
 for(const a of labels){
   if(!a.url || a.url.startsWith('#') || a.url.startsWith('mailto:') || a.url.startsWith('tel:'))continue;
   let u;try{u=new URL(a.url,publicOrigin+'/dropjourneytest/');}catch{throw Error((id||'home')+': invalid link '+a.url);}
   if(u.origin===publicOrigin && u.pathname.startsWith('/dropjourneytest/') && !u.pathname.startsWith('/dropjourneytest/assets/')){
     assert.ok(pages.some(x=>u.pathname==='/dropjourneytest/'+(x?x+'/':'')) || landers.some(x=>u.pathname==='/dropjourneytest/land/'+(x?x+'/':'')),(id||'home')+': unknown preview route '+u.pathname);
   }
 }
 assert.match(html,/name="robots" content="noindex,\s*nofollow,\s*noarchive"/,(id||'home')+' public index prevention missing');
 assert.equal((html.match(/<h1\b/g)||[]).length,1,(id||'home')+' H1 count');
 assert.doesNotMatch(html,/<form\b/i,(id||'home')+' contains unapproved submitting form');
 records.push({route:'/dropjourneytest/'+pathId,links:labels,buttonLabels:buttons});
}
const home=await read('dist/dropjourneytest/index.html'),app=await read('src/app.js');
for(const p of ['/opportunities/','/buyers/','/tickets/']){
 assert.ok(home.includes('href="/dropjourneytest'+p+'"'),'WHAT role route missing '+p);
}
const currentDefect=/location\.assign\('\/dropjourneytest\/opportunities\/'\)/.test(app);
const landerRecords=[];
for(const id of landers){
 const name=id||'';
 const html=await read('dist/dropjourneytest/land/'+(name?name+'/':'')+'index.html');
 assert.match(html,/noindex,\s*nofollow,\s*noarchive/,'Campaign lander indexing enabled');
 assert.doesNotMatch(html,/<form\b/i,'Campaign lander has unapproved form');
 landerRecords.push({route:'/dropjourneytest/land/'+(name?name+'/':''),links:(html.match(/<a\b/g)||[]).length});
}
const report={schemaVersion:1,baseRoute:'/dropjourneytest/',pageCount:records.length,landerCount:landerRecords.length,knownDefects:{finalNextForcedToExhibitors:currentDefect,previewBuyerApplicationNonSubmitting:true,ticketNotificationsNonSubmitting:true},pages:records,landers:landerRecords};
const dest=path.join(root,'reports','u0-route-inventory.json');
await mkdir(path.dirname(dest),{recursive:true});
await writeFile(dest,JSON.stringify(report,null,2)+'\n');
console.log('PASS DJ-U0 inventory: '+records.length+' site pages, '+landerRecords.length+' campaign routes; known forced-exhibitor-next='+currentDefect+'; output '+dest);
