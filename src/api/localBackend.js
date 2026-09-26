// Local mode: runs the same service as the Base44 function, in the browser, on a localStorage
// database. All tabs share the same data (each call reloads it), so the role switcher and a second
// browser tab both see live updates. There is no AI here; rule-based fallbacks are used.
import { dispatch, ServiceError } from '@shared/service.js';
import { createMemoryDb } from '@shared/memory-db.js';
import { ApiError } from './backend';
import { storage } from '@/lib/storage';

const KEY = 'loop.local.db.v1';
let resources = null;

async function loadResources() {
  resources ??= import('@data/resources.json').then((m) => (m.default || m).map((r) => ({ ...r, id: r.slug })));
  return resources;
}

// Serialize calls so two quick actions never overwrite each other's writes.
let queue = Promise.resolve();

export const localBackend = {
  call(action, args) {
    const run = async () => {
      const db = createMemoryDb(storage.getJson(KEY, {}), { onChange: (tables) => storage.setJson(KEY, tables) });
      const deps = { db, loadResources, log: () => {} };
      try {
        return await dispatch(action, args, deps);
      } catch (e) {
        if (e instanceof ServiceError) throw new ApiError(e.code, e.status, e.extra || {});
        throw e;
      }
    };
    const p = queue.then(run, run);
    queue = p.catch(() => {});
    return p;
  },
};
