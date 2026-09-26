// Single entry point for all data access from the UI.
//
// - On Base44 (VITE_BASE44_APP_ID is set by the Base44 CLI/Vite plugin), calls go to the Base44
//   backend functions in base44/functions/.
// - Without a linked Base44 app (e.g. a teammate running `npm run dev` with no account), it falls
//   back to an in-browser "local mode" that runs the exact same shared logic on bundled data.
//   Local mode has no AI; every feature still works with the rule-based fallbacks.
import { appParams } from '@/lib/app-params';

export const IS_LOCAL = !appParams.appId || import.meta.env.VITE_LOCAL_MODE === 'true';

let remotePromise = null;
let localPromise = null;

function remote() {
  remotePromise ??= import('./remoteBackend.js').then((m) => m.remoteBackend);
  return remotePromise;
}

function local() {
  localPromise ??= import('./localBackend.js').then((m) => m.localBackend);
  return localPromise;
}

const impl = () => (IS_LOCAL ? local() : remote());

export class ApiError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

async function call(method, args) {
  const b = await impl();
  return b[method](args);
}

export const api = {
  extractSituation: (text) => call('extractSituation', { text }),
  createPlan: (profile, language) => call('createPlan', { profile, language }),
  personalizePlan: (token, language) => call('personalizePlan', { token, language }),
  relocalizePlan: (token, language) => call('relocalizePlan', { token, language }),
  getPlan: (token) => call('getPlan', { token }),
  updateProgress: (token, patch) => call('updateProgress', { token, ...patch }),
  explainResource: (slug, language) => call('explainResource', { slug, language }),
  askFollowup: (token, question, history, language) => call('askFollowup', { token, question, history, language }),
  submitFeedback: (data) => call('submitFeedback', data),
  listResources: (filter) => call('listResources', filter),
  // Admin
  me: () => call('me'),
  login: (provider) => call('login', provider),
  logout: () => call('logout'),
  adminStats: () => call('adminStats'),
  adminListResources: () => call('adminListResources'),
  adminSaveResource: (resource) => call('adminSaveResource', resource),
  adminCleanup: () => call('adminCleanup'),
};
