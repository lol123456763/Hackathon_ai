import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { waitUntil, secrets } from "base44:runtime";
import { dispatch } from "../../shared/service.js";
import { makeDeps, readJson, errorResponse } from "../../shared/base44-deps.js";

// Single entry point for every Loop action: POST { action, args }. See base44/shared/service.js.
function secret(name: string): string | undefined {
  try {
    return secrets.get(name) || undefined;
  } catch {
    return undefined;
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await readJson(req);
    const result = await dispatch(String(body.action || ""), body.args || {}, makeDeps(base44, { waitUntil, geminiKey: secret("GEMINI_API_KEY"), geminiModel: secret("GEMINI_MODEL") }));
    return Response.json(result ?? { ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
