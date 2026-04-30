import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const COPY_BLOCK_GENERATE: SkillUnit = {
  skill_id: "content.copy.block.generate",
  family: "content",
  name: "Copy Block Generator",
  description: "Generate content copy blocks",
  version: "1.0.0",
  capability_tags: ["copy", "generate", "text"],
  input_schema_ref: "copy-spec.json",
  output_schema_ref: "copy-artifact.json",
  mode_support: ["public", "creator", "internal", "system"],
  risk_class: "low",
  policy_scope: ["content"],
  runtime_requirements: { tools: ["fs.write"], local_only: false },
  retry_policy: { max_attempts: 2, backoff_ms: 500, retryable_errors: ["TIMEOUT"] },
  validator_hooks: ["output-exists", "non-empty"],
  timeout_ms: 15000,
};
