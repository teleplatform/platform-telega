import type { AttentionPlan, RelationshipPlan } from "../arisha-orchestration/types.js";
import type { IntentPlan } from "../response-intent/types.js";
import type { ModePlan } from "../response-mode/types.js";
import type { ComposedResponse } from "../response-composition/types.js";
import type { ResponseQualityGateResult } from "../response-quality/types.js";
import type { SurfaceAdaptationOutput } from "../surface-adaptation/types.js";

export interface ResponseTrace {
  attention_focus: string;
  relationship_state: string;
  intent: string;
  mode: string;
  response_structure: string;
  response_depth: string;
  quality_status: string;
  quality_score: number;
  surface: string;
  delivery_mode: string;
  payload_shape: string;
  voice_enabled: boolean;
  trace_reason_summary: string;
}

export interface BuildResponseTraceInput {
  attention_plan: AttentionPlan;
  relationship_plan: RelationshipPlan;
  intent_plan: IntentPlan;
  mode_plan: ModePlan;
  composed_response: ComposedResponse;
  quality_result: ResponseQualityGateResult;
  surface_result: SurfaceAdaptationOutput;
  delivery_mode: string;
}
