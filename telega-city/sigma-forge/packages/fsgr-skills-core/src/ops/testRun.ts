import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const TEST_RUN: SkillUnit = {
  skill_id: "ops.test.run",
  family: "ops",
  name: "Test Runner",
  description: "Run test suites",
  version: "1.0.0",
  capability_tags: ["test", "run", "validate"],
  input_schema_ref: "test-config.json",
  output_schema_ref: "test-result.json",
  mode_support: ["creator", "internal", "system"],
  risk_class: "low",
  policy_scope: ["ops"],
  runtime_requirements: { tools: ["terminal.exec"], local_only: false },
  retry_policy: { max_attempts: 2, backoff_ms: 1000, retryable_errors: ["TIMEOUT", "TEST_FAIL"] },
  validator_hooks: ["output-exists"],
  timeout_ms: 60000,
};
