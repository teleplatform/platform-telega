import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const AUTH_GUARD_PATCH: SkillUnit = {
  skill_id: "backend.auth.guard.patch",
  family: "backend",
  name: "Auth Guard Patch",
  description: "Patch authentication guards",
  version: "1.0.0",
  capability_tags: ["auth", "guard", "security"],
  input_schema_ref: "auth-spec.json",
  output_schema_ref: "patch-artifact.json",
  mode_support: ["creator", "internal", "system"],
  risk_class: "high",
  policy_scope: ["backend", "security"],
  runtime_requirements: { tools: ["fs.read", "fs.write"], local_only: false },
  retry_policy: { max_attempts: 1, backoff_ms: 2000, retryable_errors: ["TIMEOUT"] },
  validator_hooks: ["output-exists", "security-scan"],
  timeout_ms: 30000,
};
