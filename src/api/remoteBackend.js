import { base44 } from './base44Client';
import { ApiError } from './backend';
import { entityToResource } from '@shared/base44-deps.js';
import { publicResource } from '@shared/service.js';

async function invoke(name, data) {
  try {
    const res = await base44.functions.invoke(name, data);
    return res.data;
  } catch (err) {
    const status = err?.response?.status ?? 0;
    throw new ApiError(err?.response?.data?.error || (status ? 'server_error' : 'network_error'), status);
  }
}

let resourcesCache = null;

export const remoteBackend = {
  extractSituation: ({ text }) => invoke('extract-situation', { text }),
  createPlan: ({ profile, language }) => invoke('create-plan', { profile, language }),
  personalizePlan: ({ token, language }) => invoke('personalize-plan', { token, language, mode: 'ai' }),
  relocalizePlan: ({ token, language }) => invoke('personalize-plan', { token, language, mode: 'relocalize' }),
  getPlan: ({ token }) => invoke('get-plan', { token }),
  updateProgress: (args) => invoke('update-plan-progress', args),
  explainResource: ({ slug, language }) => invoke('explain-resource', { slug, language }),
  askFollowup: (args) => invoke('ask-followup', args),

  async submitFeedback({ plan_token, resource_slug, rating, comment, language }) {
    try {
      await base44.entities.Feedback.create({
        rating,
        ...(plan_token ? { plan_token } : {}),
        ...(resource_slug ? { resource_slug } : {}),
        ...(comment ? { comment: String(comment).slice(0, 1000) } : {}),
        language,
      });
      return { ok: true };
    } catch {
      throw new ApiError('feedback_failed', 0);
    }
  },

  async listResources() {
    resourcesCache ??= base44.entities.Resource.filter({ is_active: true }, 'name', 5000)
      .then((rows) => rows.map((r) => publicResource(entityToResource(r))))
      .catch((e) => {
        resourcesCache = null;
        throw e;
      });
    return resourcesCache;
  },

  async me() {
    try {
      return await base44.auth.me();
    } catch {
      return null;
    }
  },
  login: (provider) =>
    provider === 'google'
      ? base44.auth.loginWithProvider('google', window.location.href)
      : base44.auth.redirectToLogin(window.location.href),
  logout: () => base44.auth.logout(window.location.origin),
  adminStats: () => invoke('admin-stats', {}),
  adminCleanup: () => invoke('cleanup-expired-plans', {}),
  async adminListResources() {
    const rows = await base44.entities.Resource.list('name', 5000);
    return rows.map(entityToResource);
  },
  async adminSaveResource(resource) {
    // eslint-disable-next-line no-unused-vars
    const { id, entity_id, created_date, updated_date, created_by, created_by_id, ...data } = resource;
    resourcesCache = null;
    if (entity_id) return entityToResource(await base44.entities.Resource.update(entity_id, data));
    return entityToResource(await base44.entities.Resource.create(data));
  },
};
