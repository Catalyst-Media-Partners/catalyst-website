/** Assemble the pinned, immutable v1b.0 archive into an isolated hidden route. */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const archiveHash = 'cc1afa9cfc6f233cb6aab725db5d6ddf236bf639f82327e37721f338162a0c04';
const partsDir = 'preview-src/infused-v1b0';
const parts = readdirSync(partsDir).filter(name => /^part-\d\d\.b64$/.test(name)).sort();
if (parts.length !== 30) throw new Error(`Expected 30 preview archive parts, got ${parts.length}`);
for (let i = 0; i < parts.length; i++) if (parts[i] !== `part-${String(i).padStart(2, '0')}.b64`) throw new Error('Archive part missing or out of order');
const encoded = parts.map(name => readFileSync(path.join(partsDir, name), 'utf8')).join('');
const bytes = Buffer.from(encoded, 'base64');
if (createHash('sha256').update(bytes).digest('hex') !== archiveHash) throw new Error('Infused source archive hash mismatch: refusing deployment');
const tmp = mkdtempSync(path.join(tmpdir(), 'infused-preview-'));
try {
  const zipPath = path.join(tmp, 'source.zip');
  writeFileSync(zipPath, bytes);
  const entries = execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' }).trim().split('\n');
  if (!entries.includes('infused_site/public/index.html')) throw new Error('Missing Infused homepage in source ZIP');
  for (const entry of entries) {
    if (entry.startsWith('/') || entry.split('/').includes('..') || entry.includes('\\')) throw new Error('Unsafe ZIP path');
  }
  execFileSync('unzip', ['-qq', '-o', zipPath, 'infused_site/public/*', '-d', tmp]);
  const from = path.join(tmp, 'infused_site', 'public');
  if (!existsSync(path.join(from, 'index.html'))) throw new Error('Infused public build missing');
  const destination = path.join('public', 'infused-preview');
  mkdirSync('public', { recursive: true });
  rmSync(destination, { recursive: true, force: true });
  cpSync(from, destination, { recursive: true });
  writeFileSync(path.join('public', '_headers'), '/infused-preview/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Cache-Control: no-store\n', 'utf8');
  console.log('Pinned Infused v1b.0 preview staged in /infused-preview/ without altering Catalyst merchant site.');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
