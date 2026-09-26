import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { waitUntil, secrets } from "base44:runtime";
import { dispatch } from "../../shared/service.js";
import { makeDeps, readJson, errorResponse, WorldConflict } from "../../shared/base44-deps.js";

function secret(name: string): string | undefined {
  try {
    return secrets.get(name) || undefined;
  } catch {
    return undefined;
  }
}

// The site that called us (resources are read from its /data/resources.json).
function siteOrigin(req: Request): string | undefined {
  const o = req.headers.get("origin") || req.headers.get("referer");
  try {
    const u = new URL(o || "");
    return /\.base44\.app$|^localhost$/.test(u.hostname) ? u.origin : undefined;
  } catch {
    return undefined;
  }
}

// Single entry point for every Loop action: POST { action, args }. See base44/shared/service.js.
// The shared neighborhood is saved once at the end; if someone else saved first, the action re-runs.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await readJson(req);
    const opts = { waitUntil, geminiKey: secret("GEMINI_API_KEY"), geminiModel: secret("GEMINI_MODEL"), seedOrigin: siteOrigin(req) };
    for (let attempt = 0; ; attempt++) {
      const deps = makeDeps(base44, opts);
      try {
        const result = await dispatch(String(body.action || ""), body.args || {}, deps);
        await deps.commit();
        return Response.json(result ?? { ok: true });
      } catch (e) {
        if (e instanceof WorldConflict && attempt < 3) continue;
        throw e;
      }
    }
  } catch (e) {
    return errorResponse(e);
  }
}
