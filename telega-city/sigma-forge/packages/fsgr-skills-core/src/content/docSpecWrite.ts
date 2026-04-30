import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const DOC_SPEC_WRITE: SkillUnit = {
  skill_id: "content.doc.spec.write",
  family: "content",
  name: "Spec Document Writer",
  description: "Write specification documents",
  version: "1.0.0",
  capability_tags: ["doc", "spec", "markdown"],
  input_schema_ref: "doc-spec.json",
  output_schema_ref: "doc-artifact.json",
  mode_support: ["public", "creator", "internal", "system"],
  risk_class: "low",
  policy_scope: ["content"],
  runtime_requirements: { tools: ["fs.write"], local_only: false },
  retry_policy: { max_attempts: 2, backoff_ms: 500, retryable_errors: ["TIMEOUT"] },
  validator_hooks: ["output-exists", "non-empty"],
  timeout_ms: 15000,
};
