// Loads data/resources.json into the Base44 Resource table (replacing what is there).
// Requires: `npx base44 login` and a linked app (`npx base44 link`), then run: npm run seed
// The demo neighborhood seeds itself automatically the first time the app loads (and on "Reset demo").
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resources = JSON.parse(readFileSync(join(root, 'data/resources.json'), 'utf8'));
const CHUNK = 150;

function exec(script) {
  const r = spawnSync('npx', ['base44', 'exec', '--privileged'], { cwd: root, input: script, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 1 << 26 });
  if (r.status !== 0) {
    console.error(r.stdout, r.stderr);
    throw new Error('base44 exec failed');
  }
  return r.stdout.trim();
}

console.log('Removing old resources…');
exec(`for (const origin of ['curated', 'research']) await base44.entities.Resource.deleteMany({ origin }); console.log('ok');`);

for (let i = 0; i < resources.length; i += CHUNK) {
  const rows = resources.slice(i, i + CHUNK);
  exec(`const rows = ${JSON.stringify(rows)};\nawait base44.entities.Resource.bulkCreate(rows);\nconsole.log(rows.length);`);
  console.log(`Seeded ${Math.min(i + CHUNK, resources.length)} / ${resources.length}`);
}
console.log('Done. Open the app — the demo neighborhood seeds itself on first load.');
