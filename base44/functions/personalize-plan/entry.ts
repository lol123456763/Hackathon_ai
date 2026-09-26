import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { upgradePlanWithAi, relocalizePlan } from "../../shared/service.js";
import { handler, makeDeps } from "../../shared/base44-deps.js";

// Upgrades a saved plan with an AI-written action plan (mode "ai", the default), or instantly
// rebuilds the rule-based plan in another language (mode "relocalize").
export default handler(createClientFromRequest, (body, base44) => {
  const args = { token: body.token, language: body.language };
  return body.mode === "relocalize" ? relocalizePlan(args, makeDeps(base44)) : upgradePlanWithAi(args, makeDeps(base44));
});
