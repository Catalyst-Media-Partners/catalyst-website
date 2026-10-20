import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
  for (const img of html.match(/<img\b[^>]*>/g) ?? []) {
    if (!/\bwidth="\d+"/.test(img) || !/\bheight="\d+"/.test(img)) problems.push(`${file}: image missing intrinsic dimensions`);
    if (!/\balt="[^"]*"/.test(img)) problems.push(`${file}: image missing alt attribute`);
  }
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

const lvPurchaseUrl = 'https://shows.map-dynamics.com/infusedlv2027/?register';
for (const page of pages) {
  const html = await readFile(page, 'utf8');
  const file = path.relative(publicDir, page);
  if (!html.includes('href="' + lvPurchaseUrl + '"')) problems.push(file + ': no direct LV booth purchase URL');
  if (!html.includes('data-cta-position="navigation"')) problems.push(file + ': no navigation purchase CTA');
  if (!html.includes('May 13–14, 2027')) problems.push(file + ': missing show dates');
  if (!html.includes('Las Vegas Convention Center')) problems.push(file + ': missing venue');
}
const home = await readFile(path.join(publicDir, 'index.html'), 'utf8');
const opportunities = await readFile(path.join(publicDir, 'opportunities/index.html'), 'utf8');
const contact = await readFile(path.join(publicDir, 'contact/index.html'), 'utf8');
if (!home.includes('data-cta-position="hero"')) problems.push('Home: missing primary purchase CTA');
if (!home.includes('data-cta-position="opportunities"')) problems.push('Home: missing opportunities purchase CTA');
if (!home.includes('data-cta-position="contact"')) problems.push('Home: missing contact purchase CTA');
if (!opportunities.includes('data-cta-position="opportunities"')) problems.push('Opportunities: missing booth purchase CTA');
if (!opportunities.includes('10×10 inline booths start at $3,000')) problems.push('Opportunities: missing verified starting price');
if (!contact.includes('data-cta-position="contact"')) problems.push('Contact: missing direct purchase CTA');
if (!contact.includes('https://form.jotform.com/262867873887079')) problems.push('Contact: Jotform assistance missing');

// Verify all extracted/optimized image assets against the source inventory.
const inventory = JSON.parse(await readFile(path.join(root, 'src/reference/image-manifest.json'), 'utf8'));
for (const image of inventory) {
  const file = path.join(publicDir, 'assets/images', image.name);
  try {
    const bytes = await readFile(file);
    if (bytes.length !== image.bytes || createHash('sha256').update(bytes).digest('hex') !== image.sha256) problems.push('Image inventory mismatch: ' + image.name);
  } catch { problems.push('Missing inventoried image: ' + image.name); }
}
if (problems.length) { console.error(problems.join('\n')); process.exitCode=1; }
else console.log(`PASS: ${pages.length} pages; ${linksChecked} internal linked destinations and ${imagesChecked} assets; one H1, preview noindex and no broken local references.`);
