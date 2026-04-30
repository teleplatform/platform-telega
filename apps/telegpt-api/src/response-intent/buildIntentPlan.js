import { selectIntent } from "./intentSelector.js";
import { getIntentDirective, getIntentRationale } from "./intentDirectives.js";
export function buildIntentPlan(input) {
    const intent = selectIntent(input.attention_plan, input.relationship_plan);
    const directive = getIntentDirective(intent);
    const rationale = getIntentRationale(intent);
    return { intent, directive, rationale };
}
//# sourceMappingURL=buildIntentPlan.js.map