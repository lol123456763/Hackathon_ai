// Adapts the Base44 SDK (inside a backend function) to the dependency interface of shared/service.js.
// All data access uses the service role; entity security rules keep private data (plans, requests,
// codes) out of reach of direct browser queries.
import { ServiceError } from './service.js';
import { askGemini } from './gemini.js';

const RESOURCE_CACHE_MS = 5 * 60 * 1000;
let resourceCache = { at: 0, list: null };

export function makeDeps(base44, { waitUntil, geminiKey, geminiModel } = {}) {
  const sr = base44.asServiceRole;
  const E = (name) => sr.entities[name];
  return {
    db: {
      list: (entity, query = {}, sort, limit = 1000) => E(entity).filter(query, sort, limit),
      create: (entity, data) => E(entity).create(data),
      bulkCreate: (entity, rows) => E(entity).bulkCreate(rows),
      update: (entity, id, patch) => E(entity).update(id, patch),
      deleteMany: (entity, query) => E(entity).deleteMany(query),
    },
    async loadResources() {
      if (resourceCache.list && Date.now() - resourceCache.at < RESOURCE_CACHE_MS) return resourceCache.list;
      const rows = await E('Resource').filter({ is_active: true }, undefined, 5000);
      resourceCache = { at: Date.now(), list: rows.map((r) => ({ ...r, id: r.slug })) };
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
  return Response.json({ error: 'server_error' }, { status: 500 });
}
