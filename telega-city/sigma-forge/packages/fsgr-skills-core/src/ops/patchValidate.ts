import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const PATCH_VALIDATE: SkillUnit = {
  skill_id: "ops.patch.validate",
  family: "ops",
  name: "Patch Validator",
  description: "Validate code patches",
  version: "1.0.0",
  capability_tags: ["patch", "validate", "review"],
  input_schema_ref: "patch-ref.json",
  output_schema_ref: "validation-result.json",
  mode_support: ["creator", "internal", "system"],
  risk_class: "medium",
  policy_scope: ["ops"],
  runtime_requirements: { tools: ["fs.read", "terminal.exec"], local_only: false },
  retry_policy: { max_attempts: 1, backoff_ms: 1000, retryable_errors: ["TIMEOUT"] },
  validator_hooks: ["output-exists"],
  timeout_ms: 30000,
};
