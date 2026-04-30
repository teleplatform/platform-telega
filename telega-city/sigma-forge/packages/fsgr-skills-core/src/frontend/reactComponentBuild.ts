import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const REACT_COMPONENT_BUILD: SkillUnit = {
  skill_id: "frontend.react.component.build",
  family: "frontend",
  name: "React Component Builder",
  description: "Build React components from spec",
  version: "1.0.0",
  capability_tags: ["react", "component", "tsx", "ui"],
  input_schema_ref: "component-spec.json",
  output_schema_ref: "component-artifact.json",
  mode_support: ["creator", "internal", "system"],
  risk_class: "low",
  policy_scope: ["frontend"],
  runtime_requirements: { tools: ["fs.write"], local_only: false },
  retry_policy: { max_attempts: 2, backoff_ms: 1000, retryable_errors: ["TIMEOUT", "VALIDATION_FAIL"] },
  validator_hooks: ["output-exists", "syntax-check"],
  timeout_ms: 30000,
};
