import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { explainResource } from "../../shared/service.js";
import { handler, makeDeps } from "../../shared/base44-deps.js";

// "Explain this simply": 3 plain-language bullets about a resource, in English or Spanish.
export default handler(createClientFromRequest, (body, base44) => explainResource({ slug: body.slug, language: body.language }, makeDeps(base44)));
