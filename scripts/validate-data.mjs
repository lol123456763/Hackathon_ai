// CI check for data/resources.json: every record must be complete and well-formed.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateResource } from './lib/resource-schema.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resources = JSON.parse(readFileSync(join(root, 'data/resources.json'), 'utf8'));
const slugs = new Set();
let bad = 0;
for (const r of resources) {
  const problems = validateResource(r);
  if (slugs.has(r.slug)) problems.push('duplicate slug');
  slugs.add(r.slug);
  // Spanish text is required for curated programs; research records fall back to English.
  if (r.origin === 'research') {
    const i = problems.indexOf('missing what_it_gives en/es');
    if (i >= 0 && r.what_it_gives_en) problems.splice(i, 1);
  }
  if (problems.length) {
    bad++;
    if (bad <= 20) console.error(`✗ ${r.slug}: ${problems.join('; ')}`);
  }
}
if (bad) {
  console.error(`${bad} of ${resources.length} resources have problems.`);
  process.exit(1);
}
console.log(`✓ ${resources.length} resources valid.`);
