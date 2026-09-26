import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { askFollowup } from "../../shared/service.js";
import { handler, makeDeps } from "../../shared/base44-deps.js";

// Answers a follow-up question about a plan, grounded only in that plan's resources.
export default handler(createClientFromRequest, (body, base44) => askFollowup({ token: body.token, question: body.question, history: body.history, language: body.language }, makeDeps(base44)));
