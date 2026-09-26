import { createClientFromRequest } from "npm:@base44/sdk@0.8.51";
import { extract } from "../../shared/service.js";
import { handler, makeDeps } from "../../shared/base44-deps.js";

// Turns a free-text description of a person's situation into a partial profile.
export default handler(createClientFromRequest, (body, base44) => extract({ text: body.text }, makeDeps(base44)));
