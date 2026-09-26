import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { waitUntil } from "base44:runtime";
import { dispatch } from "../../shared/service.js";
import { makeDeps, readJson, errorResponse } from "../../shared/base44-deps.js";

// Single entry point for every Loop action: POST { action, args }. See base44/shared/service.js.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await readJson(req);
    const result = await dispatch(String(body.action || ""), body.args || {}, makeDeps(base44, { waitUntil }));
    return Response.json(result ?? { ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
