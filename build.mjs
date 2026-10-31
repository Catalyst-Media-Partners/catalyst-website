import { cpSync, copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/verify-merchant-page.mjs'], { stdio: 'inherit' });
rmSync('public', { recursive: true, force: true });
mkdirSync('public', { recursive: true });
copyFileSync('index.html', 'public/index.html');
cpSync('assets', 'public/assets', { recursive: true });
cpSync('privategames', 'public/privategames', { recursive: true });
if (!existsSync('public/assets/favicon.png')) throw new Error('Missing deployed favicon');
execFileSync(process.execPath, ['scripts/stage-infused-preview.mjs'], { stdio: 'inherit' });
console.log('Staged merchant-review HTML unchanged, isolated INFUSED preview, and shared private games.');

