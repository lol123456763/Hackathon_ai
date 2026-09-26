// Publishes data/resources.json with the site (public/data/resources.json) so a freshly deployed
// Base44 app can seed its Resource table by itself on first use — no local tools needed.
import { mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(root, 'public/data'), { recursive: true });
copyFileSync(join(root, 'data/resources.json'), join(root, 'public/data/resources.json'));
console.log('Copied data/resources.json → public/data/resources.json');
