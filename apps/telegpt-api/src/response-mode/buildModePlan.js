import { selectMode } from "./modeSelector.js";
import { getModeDirective, getModeRationale } from "./modeDirectives.js";
export function buildModePlan(input) {
    const mode = selectMode(input.relationship_plan, input.intent_plan, input.attention_plan);
    const directive = getModeDirective(mode);
    const rationale = getModeRationale(mode);
    return { mode, directive, rationale };
}
//# sourceMappingURL=buildModePlan.js.map