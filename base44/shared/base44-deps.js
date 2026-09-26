// Adapts a Base44 SDK client (from createClientFromRequest) to the dependency interface used by
// shared/service.js. Uses the service role so anonymous visitors can use the app while entity
// security rules keep PlanSession records private.
import { ServiceError } from './service.js';

const CACHE_MS = 5 * 60 * 1000;
let cache = { at: 0, list: null };

export function entityToResource(rec) {
  // `slug` is our stable id; the Base44 record id is kept for admin edits.
  return { ...rec, id: rec.slug, entity_id: rec.id };
}

export function makeDeps(base44) {
  const sr = base44.asServiceRole;
  return {
    async loadResources() {
      if (cache.list && Date.now() - cache.at < CACHE_MS) return cache.list;
      const rows = await sr.entities.Resource.filter({ is_active: true }, undefined, 5000);
      cache = { at: Date.now(), list: rows.map(entityToResource) };
      return cache.list;
    },
    invokeLLM: (params) => sr.integrations.Core.InvokeLLM(params),
    plans: {
      create: (data) => sr.entities.PlanSession.create(data),
      async getByToken(token) {
        const rows = await sr.entities.PlanSession.filter({ share_token: token }, undefined, 1);
        return rows[0] || null;
      },
      update: (id, data) => sr.entities.PlanSession.update(id, data),
    },
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
  if (e instanceof ServiceError) return Response.json({ error: e.code }, { status: e.status });
  console.error(e);
  return Response.json({ error: 'server_error' }, { status: 500 });
}

export async function requireAdmin(base44) {
  const user = await base44.auth.me().catch(() => null);
  if (!user || user.role !== 'admin') throw new ServiceError(403, 'admin_only');
  return user;
}

/** Standard handler: parse JSON, run `fn(body, base44)`, return JSON or a clean error. */
export function handler(createClientFromRequest, fn) {
  return async (req) => {
    try {
      const base44 = createClientFromRequest(req);
      const body = await readJson(req);
      return Response.json(await fn(body, base44));
    } catch (e) {
      return errorResponse(e);
    }
  };
}
