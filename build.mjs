import { readFile, mkdir, readdir, copyFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.join(root, 'src');
const output = path.join(root, 'public');
const read = relative => readFile(path.join(source, relative), 'utf8');
const segments = ['top', 'market', 'ecosystem', 'roots', 'science', 'package', 'sell', 'services', 'buyers', 'why-vegas', 'opportunities', 'contact'];
// The route names reflect the invitation's existing named sections and its
// two category cards (MAKE and MOVE). No content comes from the v1.x website.
const routes = {
  'market': 'THE INFUSED PRODUCTS OPPORTUNITY IS MASSIVE',
  'ecosystem': 'THE FULL VALUE STREAM',
  'roots': 'IT STARTS WITH FARMING AND GENETICS',
  'science': 'SCIENCE TURNS PLANTS INTO PRODUCTS',
  'make': 'Production + co-packing',
  'package': 'THE CORNERSTONE OF COMPLIANCE',
  'move': 'Distribution',
  'sell': 'RETAIL REQUIRES MORE THAN JUST BRANDS',
  'services': 'THE BUSINESS SERVICES LAYER MATTERS',
  'buyers': 'DIRECT ACCESS TO CRITICAL DECISION MAKERS',
  'why-vegas': 'WHY VEGAS…?',
  'opportunities': 'EXHIBITOR OPPORTUNITIES',
  'contact': 'INTERESTED IN INFUSED?'
};

const before = await read('components/before.html');
const after = await read('components/after.html');
const sections = Object.fromEntries(await Promise.all(
  [...segments, 'make', 'move'].map(async id => [id, await read(`sections/${id}.html`)])
));

function replaceTokens(html, base, title, topLink) {
  return html
    .replaceAll('{{BASE}}', base)
    .replaceAll('{{PAGE_TITLE}}', title)
    .replaceAll('{{TOP_LINK}}', topLink);
}
function wrap(body, route = null) {
  const isSub = Boolean(route);
  const base = isSub ? '../' : './';
  const title = isSub ? `${routes[route]} | INFUSED Las Vegas` : 'INFUSED Las Vegas — Exhibitor Invitation';
  const header = isSub ? before.replace('<body>', '<body class="subpage">') : before;
  return replaceTokens(header + body + after, base, title, isSub ? '#main' : '#top');
}
// WCAG heading structure: convert the existing section headline to H1 on
// standalone pages, preserving every displayed word and its ID.
function standalone(section) {
  return section.replace(/<h2\b/, '<h1').replace(/<\/h2>/, '</h1>');
}
async function writePage(route, html) {
  const dir = route ? path.join(output, route) : output;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html, 'utf8');
}
async function copyTree(from, to) {
  await mkdir(to, { recursive: true });
  for (const entry of await readdir(from, { withFileTypes: true })) {
    if (entry.isDirectory()) await copyTree(path.join(from, entry.name), path.join(to, entry.name));
    else if (entry.isFile()) await copyFile(path.join(from, entry.name), path.join(to, entry.name));
  }
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await copyTree(path.join(source, 'assets'), path.join(output, 'assets'));
await writePage(null, wrap(segments.map(id => sections[id]).join('\n')));
for (const route of Object.keys(routes)) {
  await writePage(route, wrap(standalone(sections[route]), route));
}
await writeFile(path.join(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
console.log(`Built ${Object.keys(routes).length + 1} self-contained pages to public/`);
