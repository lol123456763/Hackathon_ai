import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { updateProgress } from "../../shared/service.js";
import { handler, makeDeps } from "../../shared/base44-deps.js";

// Saves checklist progress and saved resources for a plan.
export default handler(createClientFromRequest, (body, base44) => updateProgress({ token: body.token, checklist_state: body.checklist_state, saved_resources: body.saved_resources }, makeDeps(base44)));
