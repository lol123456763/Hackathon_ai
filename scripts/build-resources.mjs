// Compiles verified research files (research/verified/*.json) into data/resources.json,
// the single source of truth for the Resource database table and the app's local mode.
//
// Usage: node scripts/build-resources.mjs [--include-unverified]
//   --include-unverified  also use research/raw files that have no verified version yet (dev only)
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeRecord, TX_COUNTIES } from './lib/resource-schema.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const includeUnverified = process.argv.includes('--include-unverified');

function readDir(dir) {
  const p = join(root, dir);
  if (!existsSync(p)) return [];
  return readdirSync(p)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: `${dir}/${f}`, unit: f.replace(/\.json$/, '') }));
}

const verified = readDir('research/verified');
const units = new Map(verified.map((v) => [v.unit, { ...v, verified: true }]));
if (includeUnverified) for (const r of readDir('research/raw')) if (!units.has(r.unit)) units.set(r.unit, { ...r, verified: false });

const bySlug = new Map();
const byIdentity = new Map();
const rejected = [];
let seen = 0;

// Records from more specific (regional) files win over statewide duplicates of the same service.
const order = [...units.values()].sort((a, b) => (a.unit.startsWith('region-') ? 0 : 1) - (b.unit.startsWith('region-') ? 0 : 1) || a.unit.localeCompare(b.unit));

for (const u of order) {
  let json;
  try {
    json = JSON.parse(readFileSync(join(root, u.file), 'utf8'));
  } catch (e) {
    console.warn(`! Skipping unreadable ${u.file}: ${e.message}`);
    continue;
  }
  for (const raw of json.records || []) {
    seen++;
    const { record, problems } = normalizeRecord(raw, { verifiedDate: u.verified ? json.verified_date : null });
    if (problems.length) {
      rejected.push({ unit: u.unit, id: raw.id, name: raw.name, problems });
      continue;
    }
    if (!u.verified) record.confidence = 'medium';
    // Same service listed twice (same name + same phone or website) → merge counties, keep first.
    const identity = `${record.name.toLowerCase()}|${record.phone || record.apply_url || record.address}`;
    const dup = byIdentity.get(identity);
    if (dup) {
      dup.coverage_counties = [...new Set([...dup.coverage_counties, ...record.coverage_counties])];
      dup.categories = [...new Set([...dup.categories, ...record.categories])];
      continue;
    }
    let slug = record.slug;
    for (let i = 2; bySlug.has(slug); i++) slug = `${record.slug}-${i}`;
    record.slug = slug;
    bySlug.set(slug, record);
    byIdentity.set(identity, record);
  }
}

const resources = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data/resources.json'), JSON.stringify(resources, null, 1) + '\n');

const localCounties = new Set(resources.flatMap((r) => r.coverage_counties));
const stats = {
  resources: resources.length,
  counties: TX_COUNTIES.size,
  counties_with_local_resources: localCounties.size,
  by_category: Object.fromEntries(
    [...new Set(resources.flatMap((r) => r.categories))].sort().map((c) => [c, resources.filter((r) => r.categories.includes(c)).length]),
  ),
  verified_files: verified.length,
};
writeFileSync(join(root, 'data/stats.json'), JSON.stringify(stats, null, 2) + '\n');
writeFileSync(join(root, 'research/rejected.json'), JSON.stringify(rejected, null, 1) + '\n');

console.log(`Read ${seen} records from ${units.size} files (${verified.length} verified).`);
console.log(`Wrote ${resources.length} resources to data/resources.json; rejected ${rejected.length} (see research/rejected.json).`);
console.log(`Counties with local resources: ${localCounties.size} of ${TX_COUNTIES.size}.`);
