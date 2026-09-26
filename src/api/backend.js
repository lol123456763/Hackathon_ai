// Single entry point for all data access from the UI: api.call(action, args).
//
// - On Base44 (the app id is injected by the Base44 CLI / Vite plugin), calls go to the one backend
//   function base44/functions/app, which runs base44/shared/service.js with the Base44 database and AI.
// - Without a linked Base44 app (a teammate running `npm run dev` with no account), it runs the exact
//   same service in the browser ("local mode") on a localStorage database, with rule-based AI fallbacks.
import { appParams } from '@/lib/app-params';

export const IS_LOCAL = !appParams.appId || import.meta.env.VITE_LOCAL_MODE === 'true';

export class ApiError extends Error {
  constructor(code, status, extra = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
}

let implPromise = null;
function impl() {
  implPromise ??= IS_LOCAL ? import('./localBackend.js').then((m) => m.localBackend) : import('./remoteBackend.js').then((m) => m.remoteBackend);
  return implPromise;
}

export const api = {
  async call(action, args = {}) {
    const b = await impl();
    return b.call(action, args);
  },
};
