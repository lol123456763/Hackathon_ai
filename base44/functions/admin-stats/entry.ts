import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { computeStats } from "../../shared/service.js";
import { handler, requireAdmin } from "../../shared/base44-deps.js";

// Aggregate, anonymous analytics for the admin dashboard. Admins only.
export default handler(createClientFromRequest, async (_body, base44) => {
  await requireAdmin(base44);
  const sr = base44.asServiceRole;
  const [sessions, feedback, resources] = await Promise.all([
    sr.entities.PlanSession.list("-created_date", 5000, 0, ["created_date", "profile", "county", "plan_source"]),
    sr.entities.Feedback.list("-created_date", 5000),
    sr.entities.Resource.list(undefined, 5000, 0, ["slug", "is_active", "verified_date"]),
  ]);
  return computeStats(sessions, feedback, resources);
});
