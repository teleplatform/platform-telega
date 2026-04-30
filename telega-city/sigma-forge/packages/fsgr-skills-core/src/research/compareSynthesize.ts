import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const COMPARE_SYNTHESIZE: SkillUnit = {
  skill_id: "research.compare.synthesize",
  family: "research",
  name: "Research Compare Synthesizer",
  description: "Compare and synthesize research findings",
  version: "1.0.0",
  capability_tags: ["compare", "synthesize", "analysis"],
  input_schema_ref: "compare-spec.json",
  output_schema_ref: "synthesis-artifact.json",
  mode_support: ["creator", "internal", "system"],
  risk_class: "low",
  policy_scope: ["research"],
  runtime_requirements: { tools: ["fs.write"], local_only: false },
  retry_policy: { max_attempts: 2, backoff_ms: 1000, retryable_errors: ["TIMEOUT"] },
  validator_hooks: ["output-exists", "non-empty"],
  timeout_ms: 30000,
};
