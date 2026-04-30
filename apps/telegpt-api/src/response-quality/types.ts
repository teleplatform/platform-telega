import type {
  AttentionPlan,
  PresencePlan,
  RelationshipPlan,
} from "../arisha-orchestration/types.js";
import type { ComposedResponse } from "../response-composition/types.js";

export type QualityGateStatus = "pass" | "soft_fail";

export interface FocusGuardResult {
  ok: boolean;
  reason: string;
}

export interface ToneGuardResult {
  ok: boolean;
  reason: string;
}

export interface VerbosityGuardResult {
  ok: boolean;
  reason: string;
  revised_text: string;
}

export interface ValueGuardResult {
  ok: boolean;
  reason: string;
}

export interface ResponseQualityGateInput {
  composed_response: ComposedResponse;
  attention_plan: AttentionPlan;
  relationship_plan: RelationshipPlan;
  presence_plan: PresencePlan;
  raw_text: string;
}

export interface ResponseQualityGateResult {
  status: QualityGateStatus;
  score: number;
  final_text: string;
  focus: FocusGuardResult;
  tone: ToneGuardResult;
  verbosity: VerbosityGuardResult;
  value: ValueGuardResult;
}
