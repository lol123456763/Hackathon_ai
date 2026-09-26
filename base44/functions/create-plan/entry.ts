import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { createPlan } from "../../shared/service.js";
import { handler, makeDeps } from "../../shared/base44-deps.js";

// Matches resources and saves an anonymous plan with an instant rule-based action plan.
export default handler(createClientFromRequest, (body, base44) => createPlan({ profile: body.profile, language: body.language }, makeDeps(base44)));
