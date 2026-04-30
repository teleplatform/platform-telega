import type { BuildIntentPlanInput, IntentPlan } from "./types.js";
import { selectIntent } from "./intentSelector.js";
import { getIntentDirective, getIntentRationale } from "./intentDirectives.js";

export function buildIntentPlan(input: BuildIntentPlanInput): IntentPlan {
  const intent = selectIntent(input.attention_plan, input.relationship_plan);
  const directive = getIntentDirective(intent);
  const rationale = getIntentRationale(intent);

  return { intent, directive, rationale };
}
