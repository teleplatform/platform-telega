import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const UI_FIX: SkillUnit = {
  skill_id: "frontend.ui.fix",
  family: "frontend",
  name: "UI Fix",
  description: "Fix UI regressions and bugs",
  version: "1.0.0",
  capability_tags: ["fix", "ui", "regression"],
  input_schema_ref: "bug-report.json",
  output_schema_ref: "patch-artifact.json",
  mode_support: ["public", "creator", "internal", "system"],
  risk_class: "low",
  policy_scope: ["frontend"],
  runtime_requirements: { tools: ["fs.read", "fs.write"], local_only: false },
  retry_policy: { max_attempts: 2, backoff_ms: 1000, retryable_errors: ["TIMEOUT"] },
  validator_hooks: ["output-exists", "diff-check"],
  fallback_skills: ["frontend.react.component.build"],
  timeout_ms: 20000,
};
