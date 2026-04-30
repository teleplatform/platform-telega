import type {
  AttentionPlan,
  RelationshipPlan,
} from "../arisha-orchestration/types.js";
import type { ResponseStructureType } from "./types.js";

export function determineResponseStructure(
  attention: AttentionPlan,
  relationship: RelationshipPlan,
): ResponseStructureType {
  if (relationship.relationship_state === "sensitive_support_mode") {
    return "supportive_elaboration";
  }

  if (attention.response_shape.lead_with === "next_correct_step") {
    return "next_step_forward";
  }

  if (attention.response_shape.lead_with === "clarify_first") {
    return "single_line_ack";
  }

  return "neutral_core";
}
