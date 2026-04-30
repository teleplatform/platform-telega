import type { SkillUnit } from "../../../fsgr-contracts/src/index.js";

export const SCAN_SUMMARIZE: SkillUnit = {
  skill_id: "research.scan.summarize",
  family: "research",
  name: "Research Scan Summarizer",
  description: "Scan and summarize research topics",
  version: "1.0.0",
  capability_tags: ["scan", "summarize", "research"],
  input_schema_ref: "research-query.json",
  output_schema_ref: "summary-artifact.json",
  mode_support: ["creator", "internal", "system"],
  risk_class: "low",
  policy_scope: ["research"],
  runtime_requirements: { tools: ["net.fetch", "fs.write"], local_only: false },
  retry_policy: { max_attempts: 2, backoff_ms: 1000, retryable_errors: ["TIMEOUT", "FETCH_FAIL"] },
  validator_hooks: ["output-exists", "non-empty"],
  timeout_ms: 30000,
};
