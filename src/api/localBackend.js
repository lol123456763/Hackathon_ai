// In-browser backend used when no Base44 app is linked (local development, offline demos).
// Runs the same shared service logic as the Base44 functions, with bundled data and
// localStorage instead of the database. There is no AI here; rule-based fallbacks are used.
import * as service from '@shared/service.js';
import { publicResource } from '@shared/service.js';
import { ApiError } from './backend';
import { storage } from '@/lib/storage';

const PLANS_KEY = 'bb.local.plans';
const OVERRIDES_KEY = 'bb.local.resourceOverrides';
const FEEDBACK_KEY = 'bb.local.feedback';

let base = null;
async function baseResources() {
  base ??= import('@data/resources.json').then((m) => (m.default || m).map((r) => ({ ...r, id: r.slug })));
  return base;
}

async function allResources() {
  const overrides = storage.getJson(OVERRIDES_KEY, {});
  const list = (await baseResources()).map((r) => (overrides[r.slug] ? { ...r, ...overrides[r.slug], id: r.slug } : r));
  for (const [slug, r] of Object.entries(overrides)) {
    if (!list.some((x) => x.slug === slug)) list.push({ ...r, id: slug });
  }
  return list;
}

const plans = {
  all: () => storage.getJson(PLANS_KEY, {}),
  save(all) {
    // Keep local storage small: at most 20 plans.
    const entries = Object.entries(all).sort((a, b) => String(b[1].created_date).localeCompare(String(a[1].created_date))).slice(0, 20);
    storage.setJson(PLANS_KEY, Object.fromEntries(entries));
  },
};

const deps = {
  async loadResources() {
    return (await allResources()).filter((r) => r.is_active !== false);
  },
  invokeLLM: null,
  plans: {
    async create(data) {
      const all = plans.all();
      const rec = { ...data, id: data.share_token, created_date: new Date().toISOString() };
      all[rec.share_token] = rec;
      plans.save(all);
      return rec;
    },
    async getByToken(token) {
      return plans.all()[token] || null;
    },
    async update(id, patch) {
      const all = plans.all();
      if (!all[id]) throw new ApiError('plan_not_found', 404);
      all[id] = { ...all[id], ...patch };
      plans.save(all);
      return all[id];
    },
  },
  log: () => {},
};

async function run(fn, args) {
  try {
    return await fn(args, deps);
  } catch (e) {
    if (e instanceof service.ServiceError) throw new ApiError(e.code, e.status);
    throw e;
  }
}

export const localBackend = {
  extractSituation: (a) => run(service.extract, a),
  createPlan: (a) => run(service.createPlan, a),
  personalizePlan: (a) => run(service.upgradePlanWithAi, a),
  relocalizePlan: (a) => run(service.relocalizePlan, a),
  getPlan: (a) => run(service.getPlan, a),
  updateProgress: (a) => run(service.updateProgress, a),
  explainResource: (a) => run(service.explainResource, a),
  askFollowup: (a) => run(service.askFollowup, a),
  async submitFeedback(data) {
    const list = storage.getJson(FEEDBACK_KEY, []);
    list.push({ ...data, created_date: new Date().toISOString() });
    storage.setJson(FEEDBACK_KEY, list.slice(-200));
    return { ok: true };
  },
  async listResources() {
    return (await allResources()).filter((r) => r.is_active !== false).map(publicResource);
  },
  // Local mode has no accounts; the admin screens work on this browser's copy of the data.
  me: async () => ({ id: 'local', email: 'local-admin', full_name: 'Local admin', role: 'admin', local: true }),
  login: async () => {},
  logout: async () => {},
  async adminStats() {
    const sessions = Object.values(plans.all());
    return service.computeStats(sessions, storage.getJson(FEEDBACK_KEY, []), await allResources());
  },
  async adminListResources() {
    return allResources();
  },
  async adminSaveResource(resource) {
    const overrides = storage.getJson(OVERRIDES_KEY, {});
    // eslint-disable-next-line no-unused-vars
    const { id, entity_id, ...data } = resource;
    overrides[data.slug] = data;
    storage.setJson(OVERRIDES_KEY, overrides);
    return { ...data, id: data.slug };
  },
  async adminCleanup() {
    const today = new Date().toISOString().slice(0, 10);
    const all = plans.all();
    let deleted = 0;
    for (const [k, p] of Object.entries(all)) {
      if (p.expires_at && p.expires_at < today) {
        delete all[k];
        deleted++;
      }
    }
    plans.save(all);
    return { deleted };
  },
};
