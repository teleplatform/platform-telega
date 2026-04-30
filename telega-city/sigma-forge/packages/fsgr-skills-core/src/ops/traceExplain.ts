import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const TRACE_EXPLAIN: SkillUnit = {
  skill_id: "ops.trace.explain",
  family: "ops",
  name: "Trace Explainer",
  description: "Explain execution traces",
  version: "1.0.0",
  capability_tags: ["trace", "explain", "audit"],
  input_schema_ref: "trace-ref.json",
  output_schema_ref: "explain-artifact.json",
  mode_support: ["creator", "internal", "system"],
  risk_class: "low",
  policy_scope: ["ops"],
  runtime_requirements: { tools: ["fs.read"], local_only: false },
  retry_policy: { max_attempts: 1, backoff_ms: 500, retryable_errors: ["TIMEOUT"] },
  validator_hooks: ["output-exists"],
  timeout_ms: 15000,
};
