import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { getPlan } from "../../shared/service.js";
import { handler, makeDeps } from "../../shared/base44-deps.js";

// Loads a saved plan by its share token.
export default handler(createClientFromRequest, (body, base44) => getPlan({ token: body.token }, makeDeps(base44)));
