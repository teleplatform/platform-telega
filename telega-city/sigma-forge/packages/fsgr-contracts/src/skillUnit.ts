export type SkillFamily = "frontend" | "backend" | "content" | "research" | "ops";
export type ActorMode = "public" | "creator" | "internal" | "system";
export type RiskClass = "low" | "medium" | "high";
export type PlanMode = "fast" | "safe" | "quality" | "creator";
export type BudgetClass = "low" | "medium" | "high";
export type PrivacyPreference = "prefer_local" | "allow_remote" | "require_local";
export type ExecutionMode = "fast" | "safe" | "quality" | "creator";
export type NodeStatus =
  | "pending"
  | "ready"
  | "running"
  | "blocked"
  | "waiting_dependency"
  | "needs_review"
  | "failed"
  | "completed"
  | "rolled_back";
export type RunStatus = "created" | "planned" | "running" | "paused" | "failed" | "completed" | "degraded";
export type EdgeKind = "dependency" | "artifact_flow" | "control_flow";
export type ArtifactKind = "code" | "doc" | "json" | "asset" | "report" | "patch" | "bundle";
export type ValidatorStatus = "passed" | "failed" | "warning";

export interface SkillUnit {
  skill_id: string;
  family: SkillFamily;
  name: string;
  description: string;
  version: string;
  capability_tags: string[];
  input_schema_ref: string;
  output_schema_ref: string;
  mode_support: ActorMode[];
  risk_class: RiskClass;
  policy_scope: string[];
  runtime_requirements: {
    tools?: string[];
    providers?: string[];
    local_only?: boolean;
  };
  retry_policy: {
    max_attempts: number;
    backoff_ms: number;
    retryable_errors: string[];
  };
  validator_hooks: string[];
  fallback_skills?: string[];
  timeout_ms: number;
  deprecated?: boolean;
}
