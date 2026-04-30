import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const DB_SCHEMA_PATCH: SkillUnit = {
  skill_id: "backend.db.schema.patch",
  family: "backend",
  name: "DB Schema Patch",
  description: "Patch database schema",
  version: "1.0.0",
  capability_tags: ["db", "schema", "migration"],
  input_schema_ref: "schema-spec.json",
  output_schema_ref: "migration-artifact.json",
  mode_support: ["internal", "system"],
  risk_class: "high",
  policy_scope: ["backend", "data"],
  runtime_requirements: { tools: ["fs.write"], local_only: false },
  retry_policy: { max_attempts: 1, backoff_ms: 2000, retryable_errors: ["TIMEOUT", "SCHEMA_CONFLICT"] },
  validator_hooks: ["output-exists", "schema-validate"],
  timeout_ms: 30000,
};
