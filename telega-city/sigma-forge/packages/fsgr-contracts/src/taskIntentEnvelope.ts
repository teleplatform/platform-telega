import type { ActorMode, ExecutionMode, BudgetClass, PrivacyPreference } from "./skillUnit.js";

export interface TaskIntentEnvelope {
  task_id: string;
  session_id?: string;
  actor_id: string;
  actor_mode: ActorMode;
  intent_key: string;
  task_kind: string;
  goal: string;
  constraints: string[];
  requested_artifact?: string;
  execution_mode: ExecutionMode;
  budget_class?: BudgetClass;
  privacy_preference?: PrivacyPreference;
  trace_id?: string;
  metadata?: Record<string, unknown>;
}
