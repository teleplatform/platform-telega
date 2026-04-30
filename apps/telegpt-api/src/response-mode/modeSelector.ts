import type { AttentionPlan, RelationshipPlan } from "../arisha-orchestration/types.js";
import type { IntentPlan } from "../response-intent/types.js";
import type { ResponseMode } from "./types.js";

export function selectMode(
  relationship: RelationshipPlan,
  intent: IntentPlan,
  attention: AttentionPlan,
): ResponseMode {
  if (relationship.relationship_state === "sensitive_support_mode") {
    return "supportive";
  }

  if (intent.intent === "direction") {
    return "guiding";
  }

  if (
    attention.response_shape.branching === "low" &&
    attention.response_shape.depth === "low"
  ) {
    return "concise";
  }

  return "grounding";
}
