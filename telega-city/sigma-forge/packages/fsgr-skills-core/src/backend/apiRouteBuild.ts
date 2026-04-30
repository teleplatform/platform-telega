import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const API_ROUTE_BUILD: SkillUnit = {
  skill_id: "backend.api.route.build",
  family: "backend",
  name: "API Route Builder",
  description: "Build API route handlers",
  version: "1.0.0",
  capability_tags: ["api", "route", "handler"],
  input_schema_ref: "route-spec.json",
  output_schema_ref: "route-artifact.json",
  mode_support: ["creator", "internal", "system"],
  risk_class: "medium",
  policy_scope: ["backend"],
  runtime_requirements: { tools: ["fs.write"], local_only: false },
  retry_policy: { max_attempts: 2, backoff_ms: 1500, retryable_errors: ["TIMEOUT", "SYNTAX_ERROR"] },
  validator_hooks: ["output-exists", "syntax-check"],
  timeout_ms: 30000,
};
