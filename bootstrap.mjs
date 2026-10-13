import {createHash} from 'node:crypto';
import {cpSync,existsSync,mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
if (existsSync('build.mjs') && existsSync('src/reference/INFUSED_Las_Vegas_Exhibitor_Invitation.html')) {
 console.log('Editable INFUSED source already exists.'); process.exit(0);
}
const names=readdirSync('preview-src/infused-v1b0').filter(n=>/^part-\d\d\.b64$/.test(n)).sort();
if(names.length!==30)throw new Error('Missing INFUSED archived source segments');
names.forEach((n,i)=>{if(n!=='part-'+String(i).padStart(2,'0')+'.b64')throw new Error('Archive segment sequence mismatch')});
const archive=Buffer.concat(names.map(n=>readFileSync(path.join('preview-src/infused-v1b0',n))));
const digest=createHash('sha256').update(archive).digest('hex');
if(digest!=='cc1afa9cfc6f233cb6aab725db5d6ddf236bf639f82327e37721f338162a0c04')throw new Error('Approved INFUSED archive checksum mismatch: '+digest);
const tmp=mkdtempSync(path.join(tmpdir(),'infused-approval-'));
try {
 const zip=path.join(tmp,'source.zip');writeFileSync(zip,archive);
 const entries=execFileSync('unzip',['-Z1',zip],{encoding:'utf8'}).trim().split('\n');
 for(const entry of entries)if(!entry.startsWith('infused_site/')||entry.split('/').includes('..')||entry.includes('\\'))throw new Error('Unsafe ZIP entry '+entry);
 execFileSync('unzip',['-qq','-o',zip,'-d',tmp]);
 for(const item of readdirSync(path.join(tmp,'infused_site')))cpSync(path.join(tmp,'infused_site',item),path.join(process.cwd(),item),{recursive:true,force:true});
 if(!existsSync('build.mjs')||!existsSync('src/sections/top.html'))throw new Error('INFUSED source extraction incomplete');
 console.log('Approved INFUSED v1b.0 full source restored without alteration.');
}finally{rmSync(tmp,{recursive:true,force:true})}
