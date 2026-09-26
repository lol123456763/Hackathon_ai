// Builds data/resources.json — the single source of truth for the Resource table and local mode:
//   1. the curated real programs from spec 9A (base44/shared/data/programs.js), and
//   2. verified Texas research records (research/verified/*.json), minus duplicates of curated programs.
//
// Usage: node scripts/build-resources.mjs [--include-unverified]
//   --include-unverified  also use research/raw files that have no verified version yet (dev only)
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeResearchRecord, duplicatesCurated, TX_COUNTIES } from './lib/resource-schema.mjs';
import { CURATED_PROGRAMS } from '../base44/shared/data/programs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const includeUnverified = process.argv.includes('--include-unverified');

function readDir(dir) {
  const p = join(root, dir);
  if (!existsSync(p)) return [];
  return readdirSync(p).filter((f) => f.endsWith('.json')).map((f) => ({ file: `${dir}/${f}`, unit: f.replace(/\.json$/, '') }));
}

const verified = readDir('research/verified');
const units = new Map(verified.map((v) => [v.unit, { ...v, verified: true }]));
if (includeUnverified) for (const r of readDir('research/raw')) if (!units.has(r.unit)) units.set(r.unit, { ...r, verified: false });

const bySlug = new Map(CURATED_PROGRAMS.map((r) => [r.slug, { ...r, origin: 'curated' }]));
const identities = new Map();
const rejected = [];
let seen = 0;
let curatedDupes = 0;

// Regional files first: a specific local listing wins over a statewide duplicate of the same service.
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
    const { record, problems } = normalizeResearchRecord(raw, { verifiedDate: u.verified ? json.verified_date : null });
    if (problems.length) {
      rejected.push({ unit: u.unit, id: raw.id, name: raw.name, problems });
      continue;
    }
    if (duplicatesCurated(record)) {
      curatedDupes++;
      continue;
    }
    if (!u.verified) record.confidence = 'medium';
    const identity = `${record.name.toLowerCase()}|${record.phone || record.apply_url || record.address}`;
    const dup = identities.get(identity);
    if (dup) {
      dup.coverage_counties = [...new Set([...dup.coverage_counties, ...record.coverage_counties])];
      dup.categories = [...new Set([...dup.categories, ...record.categories])];
      continue;
    }
    let slug = record.slug;
    for (let i = 2; bySlug.has(slug); i++) slug = `${record.slug}-${i}`;
    record.slug = slug;
    bySlug.set(slug, record);
    identities.set(identity, record);
  }
}

const resources = [...bySlug.values()].sort((a, b) => (a.origin === b.origin ? a.slug.localeCompare(b.slug) : a.origin === 'curated' ? -1 : 1));
mkdirSync(join(root, 'data'), { recursive: true });
writeFileSync(join(root, 'data/resources.json'), JSON.stringify(resources, null, 1) + '\n');

const localCounties = new Set(resources.flatMap((r) => r.coverage_counties || []));
const stats = {
  resources: resources.length,
  curated: CURATED_PROGRAMS.length,
  research: resources.length - CURATED_PROGRAMS.length,
  counties: TX_COUNTIES.size,
  counties_with_local_resources: localCounties.size,
  verified_research_files: verified.length,
};
writeFileSync(join(root, 'data/stats.json'), JSON.stringify(stats, null, 2) + '\n');
mkdirSync(join(root, 'research'), { recursive: true });
writeFileSync(join(root, 'research/rejected.json'), JSON.stringify(rejected, null, 1) + '\n');

console.log(`Research: read ${seen} records from ${units.size} files (${verified.length} verified); ${curatedDupes} duplicated curated programs; rejected ${rejected.length}.`);
console.log(`Wrote ${resources.length} resources (${CURATED_PROGRAMS.length} curated) to data/resources.json. Counties with local resources: ${localCounties.size}/${TX_COUNTIES.size}.`);
