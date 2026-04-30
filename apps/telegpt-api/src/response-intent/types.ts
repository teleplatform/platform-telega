import type {
  AttentionPlan,
  RelationshipPlan,
} from "../arisha-orchestration/types.js";

export type ResponseIntent = "support" | "direction" | "clarify" | "stabilize";

export interface IntentPlan {
  intent: ResponseIntent;
  directive: string;
  rationale: string;
}

export interface BuildIntentPlanInput {
  attention_plan: AttentionPlan;
  relationship_plan: RelationshipPlan;
}
