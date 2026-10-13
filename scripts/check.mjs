import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const pages = [];
const problems = [];
async function walk(dir) {
  for (const d of await readdir(dir, {withFileTypes:true})) {
    const full = path.join(dir,d.name);
    if (d.isDirectory()) await walk(full);
    else if (d.name==='index.html') pages.push(full);
  }
}
await walk(publicDir);
const expected = ['/','/market/','/ecosystem/','/roots/','/science/','/make/','/package/','/move/','/sell/','/services/','/buyers/','/why-vegas/','/opportunities/','/contact/'];
const found = new Set(pages.map(p=>'/'+path.relative(publicDir,path.dirname(p)).replaceAll(path.sep,'/')+'/').map(p=>p==='//'?'/':p));
for (const route of expected) if (!found.has(route)) problems.push('Missing route '+route);
if (pages.length!==expected.length) problems.push(`Unexpected page count ${pages.length}`);
let linksChecked=0, imagesChecked=0;
for (const page of pages) {
  const html = await readFile(page,'utf8');
  const file = path.relative(publicDir,page);
  if (!/<html\b[^>]*lang="en"/.test(html)) problems.push(`${file}: missing lang`);
  if (!/<meta name="robots" content="noindex, nofollow, noarchive">/.test(html)) problems.push(`${file}: preview robots missing`);
  if ((html.match(/<h1\b/g)||[]).length!==1) problems.push(`${file}: expected one h1`);
  if (!html.includes('FROM ROOTS') && file==='index.html') problems.push('Home page copy altered');
  if (html.includes('data:image')) problems.push(`${file}: embedded image remains`);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]));
  const duplicateIds = [...ids].filter(id => [...html.matchAll(/\bid="([^"]+)"/g)].filter(m=>m[1]===id).length>1);
  if (duplicateIds.length) problems.push(`${file}: duplicate IDs ${duplicateIds.join(',')}`);
  for(const x of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const url=x[1];
    if (/^(https?:|mailto:|tel:|data:)/i.test(url)) continue;
    if (url.startsWith('#')) { if(!ids.has(url.slice(1))) problems.push(`${file}: unknown fragment ${url}`); continue; }
    const target=url.split('#')[0].split('?')[0];
    const abs=path.resolve(path.dirname(page),target);
    if(abs!==publicDir && !abs.startsWith(publicDir+path.sep)) { problems.push(`${file}: outside public ${url}`); continue; }
    try {const s=await stat(abs); if(s.isDirectory()) await stat(path.join(abs,'index.html'))}
    catch {problems.push(`${file}: missing link or resource ${url}`)}
    if (x[0].startsWith('href')) linksChecked++;
    else imagesChecked++;
  }
}
if (problems.length) { console.error(problems.join('\n')); process.exitCode=1; }
else console.log(`PASS: ${pages.length} pages; ${linksChecked} internal linked destinations and ${imagesChecked} assets; one H1, preview noindex and no broken local references.`);
