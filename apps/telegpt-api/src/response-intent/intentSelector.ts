import type { AttentionPlan, RelationshipPlan } from "../arisha-orchestration/types.js";
import type { ResponseIntent } from "./types.js";

export function selectIntent(
  attention: AttentionPlan,
  relationship: RelationshipPlan,
): ResponseIntent {
  if (relationship.relationship_state === "sensitive_support_mode") {
    return "support";
  }

  if (attention.response_shape.lead_with === "next_correct_step") {
    return "direction";
  }

  if (attention.response_shape.lead_with === "clarify_first") {
    return "clarify";
  }

  return "stabilize";
}
