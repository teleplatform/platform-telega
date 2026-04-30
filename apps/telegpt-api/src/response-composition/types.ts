import type {
  AttentionPlan,
  PresencePlan,
  RelationshipPlan,
} from "../arisha-orchestration/types.js";
import type { IntentPlan } from "../response-intent/types.js";
import type { ModePlan } from "../response-mode/types.js";

export type ResponseStructureType =
  | "single_line_ack"
  | "next_step_forward"
  | "supportive_elaboration"
  | "neutral_core";

export type ResponseDepth = "brief" | "medium" | "deep";

export interface ResponseCompositionPlan {
  structure_type: ResponseStructureType;
  depth: ResponseDepth;
  segments: string[];
}

export interface BuildResponseInput {
  attention_plan: AttentionPlan;
  relationship_plan: RelationshipPlan;
  presence_plan: PresencePlan;
  intent_plan: IntentPlan;
  mode_plan: ModePlan;
}

export interface ComposedResponse {
  text: string;
  structure: ResponseStructureType;
  depth: ResponseDepth;
}
