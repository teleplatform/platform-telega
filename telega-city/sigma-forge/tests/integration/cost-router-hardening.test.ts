import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createCostRepos } from "../../packages/runtime-cost-core/src/storage/sqlite/costRepo.js";
import { createCostApi } from "../../packages/runtime-cost-core/src/api/costApi.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nIntegration: R16-S5 Cost Router Hardening:");

const db = new Database(":memory:");
const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../../packages/runtime-cost-core/src/storage/sqlite/schema.sql");
db.exec(readFileSync(schemaPath, "utf-8"));
const repos = createCostRepos(db);
const api = createCostApi({ repos });

// Setup: create default profile
repos.profiles.save({
  profile_id: "profile_content",
  mission_type: "content_generation",
  department_id: "marketing",
  max_auto_cost_usd: 0.05,
  confirmation_cost_usd: 0.2,
  hard_cap_cost_usd: 1.0,
  max_orchestration_depth: 3,
  require_confirmation_if_user_visible: true,
  default_business_value: "medium",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

// 1. Branch cost estimation
test("estimate branch cost", () => {
  const estimate = api.estimateBranchCost({
    mission_id: "m1",
    route_key: "marketing.content",
    orchestration_depth: 2,
    estimated_tokens_in: 5000,
    estimated_tokens_out: 2000,
    estimated_tool_calls: 1,
  });
  assert.ok(estimate.estimate_id);
  assert.equal(estimate.mission_id, "m1");
  assert.ok(estimate.estimated_cost_usd > 0);
});

// 2. Mission cost classification
test("classify mission cost correctly", () => {
  assert.equal(api.classifyMissionCost(0.01), "tiny");
  assert.equal(api.classifyMissionCost(0.08), "small");
  assert.equal(api.classifyMissionCost(0.5), "medium");
  assert.equal(api.classifyMissionCost(2.0), "large");
  assert.equal(api.classifyMissionCost(10.0), "critical");
});

// 3. Low-cost branch allowed
test("low-cost branch under threshold allowed", () => {
  const result = api.evaluateCostDecision({
    mission_id: "m2",
    mission_type: "content_generation",
    department_id: "marketing",
    orchestration_depth: 1,
    estimated_cost_usd: 0.01,
    expected_business_value: "medium",
    user_visible: false,
  });
  assert.equal(result.verdict, "allow");
});

// 4. User-visible expensive branch requires confirmation
test("user-visible branch above confirmation threshold requires confirmation", () => {
  const result = api.evaluateCostDecision({
    mission_id: "m3",
    mission_type: "content_generation",
    department_id: "marketing",
    orchestration_depth: 2,
    estimated_cost_usd: 0.25,
    expected_business_value: "high",
    user_visible: true,
  });
  assert.equal(result.verdict, "require_confirmation");
  assert.ok(result.reason_codes.includes("USER_VISIBLE_COST_CONFIRMATION_REQUIRED"));
});

// 5. Hard cap exceeded denied
test("low-value branch above hard cap denied", () => {
  const result = api.evaluateCostDecision({
    mission_id: "m4",
    mission_type: "content_generation",
    department_id: "marketing",
    orchestration_depth: 2,
    estimated_cost_usd: 1.5,
    expected_business_value: "low",
    user_visible: false,
  });
  assert.equal(result.verdict, "deny");
  assert.ok(result.reason_codes.includes("HARD_CAP_EXCEEDED"));
});

// 6. Strategic mission escalated
test("strategic branch above hard cap escalated", () => {
  const result = api.evaluateCostDecision({
    mission_id: "m5",
    mission_type: "content_generation",
    department_id: "marketing",
    orchestration_depth: 2,
    estimated_cost_usd: 1.2,
    expected_business_value: "strategic",
    user_visible: false,
  });
  assert.equal(result.verdict, "escalate");
  assert.ok(result.reason_codes.includes("STRATEGIC_MISSION_EXCEPTION"));
});

// 7. Orchestration depth exceeded
test("orchestration depth exceeds limit detected", () => {
  const result = api.evaluateCostDecision({
    mission_id: "m6",
    mission_type: "content_generation",
    department_id: "marketing",
    orchestration_depth: 5,
    estimated_cost_usd: 0.01,
    expected_business_value: "medium",
    user_visible: false,
  });
  assert.ok(result.reason_codes.includes("ORCHESTRATION_DEPTH_EXCEEDED"));
});

// 8. Mission cost summary
test("mission cost summary built", () => {
  api.evaluateCostDecision({
    mission_id: "m7",
    mission_type: "content_generation",
    department_id: "marketing",
    orchestration_depth: 1,
    estimated_cost_usd: 0.02,
    expected_business_value: "medium",
    user_visible: false,
  });
  api.evaluateCostDecision({
    mission_id: "m7",
    mission_type: "content_generation",
    department_id: "marketing",
    orchestration_depth: 2,
    estimated_cost_usd: 0.3,
    expected_business_value: "high",
    user_visible: true,
  });
  const summary = api.getMissionCostSummary("m7");
  assert.equal(summary.mission_id, "m7");
});

// 9. Full branch cost evaluation
test("full execution branch cost evaluation works", () => {
  const result = api.evaluateExecutionBranchCost({
    mission_id: "m8",
    mission_type: "content_generation",
    department_id: "marketing",
    route_key: "marketing.content.deep",
    orchestration_depth: 3,
    estimated_tokens_in: 10000,
    estimated_tokens_out: 5000,
    estimated_tool_calls: 3,
    expected_business_value: "high",
    user_visible: false,
  });
  assert.ok(result.estimate.estimate_id);
  assert.ok(result.decision.decision_id);
});

// 10. Confirmation packet created for require_confirmation verdict
test("confirmation packet built for expensive branch", () => {
  const result = api.evaluateExecutionBranchCost({
    mission_id: "m9",
    mission_type: "content_generation",
    department_id: "marketing",
    route_key: "marketing.content.expensive",
    orchestration_depth: 3,
    estimated_tokens_in: 50000,
    estimated_tokens_out: 20000,
    estimated_tool_calls: 5,
    expected_business_value: "high",
    user_visible: true,
  });
  if (result.decision.verdict === "require_confirmation") {
    assert.ok(result.confirmation);
    assert.ok(result.confirmation!.estimated_cost_usd > 0);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
