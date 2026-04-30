import type { AttentionPlan, RelationshipPlan } from "../arisha-orchestration/types.js";
import type { IntentPlan } from "../response-intent/types.js";

export type ResponseMode = "concise" | "supportive" | "guiding" | "grounding";

export interface ModePlan {
  mode: ResponseMode;
  directive: string;
  rationale: string;
}

export interface BuildModePlanInput {
  attention_plan: AttentionPlan;
  relationship_plan: RelationshipPlan;
  intent_plan: IntentPlan;
}
