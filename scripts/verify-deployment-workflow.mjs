/**
 * Static release-governance checks. No credentials or Cloudflare API calls.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const source = readFileSync('.github/workflows/deploy-catalyst.yml','utf8');
for(const [label,re] of [
 ['main-only release', /push:\s*\n\s*branches: \[main\]/],
 ['manual authorization', /DEPLOY-CATALYST-SITE/],
 ['merge actor', /merged_by.*PASS-LH/],
 ['passing PR QA', /name=="validate".*conclusion=="success"/],
 ['static merchant page check', /npm run check/],
 ['account scope', /7fe07bc649cd7366b14ba607c115e895/],
 ['dedicated worker target', /wrangler@4\.102\.0 deploy --name catalyst-website/],
 ['preserve existing bindings', /keep_vars = true/],
 ['auth secret', /secrets\.CLOUDFLARE_API_TOKEN/],
 ['Cloudflare deployment 100%', /percentage == 100/],
 ['settings response', /\.result\.bindings \| type == "array"/],
 ['durable game binding verification', /HANGMAN_ROOMS.*durable_object_namespace.*HangmanRoom/],
 ['works.dev smoke', /catalyst-website\.cannacon-org-s-account\.workers\.dev/],
]) assert.match(source,re,'Missing '+label);
assert.doesNotMatch(source,/wrangler deploy --name cannacon-prod/, 'Never deploy CannaCon from Catalyst');
const chunks=source.split(/(?=^      - name: )/m).filter(x=>x.startsWith('      - name: '));
let inspected=0;
for(const chunk of chunks){
  const marker='        run: |\n';
  const start=chunk.indexOf(marker);
  if(start<0)continue;
  const commands=chunk.slice(start+marker.length).split('\n').map(line=>line.startsWith('          ')?line.slice(10):line).join('\n');
  const r=spawnSync('bash',['-n'],{input:commands,encoding:'utf8'});
  assert.equal(r.status,0, 'Invalid release shell in '+chunk.split('\n')[0]+': '+r.stderr);
  inspected++;
}
assert.ok(inspected>=6, 'Expected release authorization and pre/post-deploy shell checks');
console.log('Catalyst owner-gated deployment workflow verified; '+inspected+' Bash steps parse cleanly.');

