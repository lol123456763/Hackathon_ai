// Adapts the Base44 SDK (inside the `app` backend function) to the dependency interface of shared/service.js.
//
// Base44 rate-limits entity calls, so:
// - the shared demo neighborhood lives in ONE `World` record (see world-db.js): 1 read per request,
//   1 write per change, with a version check;
// - private plans (PlanSession) and GoldenOutput stay in their own tables;
// - the 1,900+ resources are read from the static file published with the site (/data/resources.json).
// All data access uses the service role; entity rules keep everything out of direct browser reach.
import { ServiceError } from './service.js';
import { askGemini } from './gemini.js';
import { createWorldDb, WorldConflict } from './world-db.js';

const RESOURCE_CACHE_MS = 10 * 60 * 1000;
let resourceCache = { at: 0, list: null };

async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const limited = /rate limit/i.test(e?.message || '') || e?.status === 429 || e?.response?.status === 429;
      if (!limited || attempt >= 4) throw e;
      await new Promise((r) => setTimeout(r, 350 * 2 ** attempt + Math.random() * 250));
    }
  }
}

export { WorldConflict };

export function makeDeps(base44, { waitUntil, geminiKey, geminiModel, seedOrigin } = {}) {
  const sr = base44.asServiceRole;
  const E = (name) => sr.entities[name];

  const passthrough = {
    list: (entity, query = {}, sort, limit = 1000) => withRetry(() => E(entity).filter(query, sort, limit)),
    create: (entity, data) => withRetry(() => E(entity).create(data)),
    bulkCreate: (entity, rows) => withRetry(() => E(entity).bulkCreate(rows)),
    update: (entity, id, patch) => withRetry(() => E(entity).update(id, patch)),
    deleteMany: (entity, query) => withRetry(() => E(entity).deleteMany(query)),
  };

  const store = {
    async load() {
      const rows = await withRetry(() => E('World').filter({ key: 'world' }, undefined, 1));
      const r = rows[0];
      return r ? { id: r.id, version: r.version || 0, data: r.data || {} } : null;
    },
    async save(record, expectedVersion) {
      const current = (await withRetry(() => E('World').filter({ key: 'world' }, undefined, 1)))[0];
      if ((current?.version || 0) !== expectedVersion) throw new WorldConflict('world changed');
      if (current) await withRetry(() => E('World').update(current.id, { version: record.version, data: record.data }));
      else await withRetry(() => E('World').create({ key: 'world', version: record.version, data: record.data }));
    },
  };
  const world = createWorldDb(store, passthrough);

  return {
    db: world.db,
    commit: () => world.commit(),
    async loadResources() {
      if (resourceCache.list && Date.now() - resourceCache.at < RESOURCE_CACHE_MS) return resourceCache.list;
      let rows = null;
      if (seedOrigin) {
        try {
          const res = await fetch(new URL('/data/resources.json', seedOrigin));
          if (res.ok) rows = await res.json();
        } catch (e) {
          console.log('resources.json fetch failed', e?.message);
        }
      }
      // Fallback: the Resource table (e.g. programs edited in the Base44 dashboard).
      if (!rows?.length) rows = await passthrough.list('Resource', { is_active: true }, undefined, 5000);
      resourceCache = { at: Date.now(), list: rows.filter((r) => r.is_active !== false).map((r) => ({ ...r, id: r.slug })) };
      return resourceCache.list;
    },
    // Gemini (if the GEMINI_API_KEY secret is set) for text; Base44 InvokeLLM for images and as backup.
    invokeLLM: async (params) => {
      if (geminiKey && !params.file_urls) {
        try {
          return await askGemini(params, { key: geminiKey, model: geminiModel || undefined });
        } catch (e) {
          console.log('Gemini failed, using InvokeLLM', e?.message);
        }
      }
      return sr.integrations.Core.InvokeLLM(params);
    },
    async uploadImage(dataUrl) {
      const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
      if (!m) return null;
      const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      const file = new File([bytes], `surplus.${m[1].split('/')[1]}`, { type: m[1] });
      const { file_url } = await sr.integrations.Core.UploadFile({ file });
      return file_url || null;
    },
    waitUntil,
    log: (...args) => console.log(...args),
  };
}

export async function readJson(req) {
  if (req.method !== 'POST') throw new ServiceError(405, 'method_not_allowed');
  try {
    return await req.json();
  } catch {
    throw new ServiceError(400, 'invalid_json');
  }
}

export function errorResponse(e) {
  if (e instanceof ServiceError) return Response.json({ error: e.code, ...(e.extra || {}) }, { status: e.status });
  console.error(e);
  const limited = /rate limit/i.test(e?.message || '');
  return Response.json({ error: limited ? 'busy' : 'server_error' }, { status: limited ? 503 : 500 });
}
