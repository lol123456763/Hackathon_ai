import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { handler, requireAdmin } from "../../shared/base44-deps.js";

// Deletes plans past their expires_at date (90 days after creation), keeping the privacy promise.
// Run it from the admin dashboard, or schedule it as a daily workflow in the Base44 dashboard.
export default handler(createClientFromRequest, async (_body, base44) => {
  await requireAdmin(base44);
  const sr = base44.asServiceRole;
  const today = new Date().toISOString().slice(0, 10);
  const all = await sr.entities.PlanSession.list("created_date", 5000, 0, ["expires_at"]);
  const expired = all.filter((p) => p.expires_at && p.expires_at < today);
  for (const p of expired) await sr.entities.PlanSession.delete(p.id);
  return { deleted: expired.length };
});
