import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const LAYOUT_SECTION_COMPOSE: SkillUnit = {
  skill_id: "frontend.layout.section.compose",
  family: "frontend",
  name: "Layout Section Compose",
  description: "Compose UI layout sections",
  version: "1.0.0",
  capability_tags: ["layout", "section", "compose"],
  input_schema_ref: "layout-spec.json",
  output_schema_ref: "layout-artifact.json",
  mode_support: ["creator", "internal", "system"],
  risk_class: "low",
  policy_scope: ["frontend"],
  runtime_requirements: { tools: ["fs.write"], local_only: false },
  retry_policy: { max_attempts: 2, backoff_ms: 1000, retryable_errors: ["TIMEOUT"] },
  validator_hooks: ["output-exists"],
  timeout_ms: 25000,
};
