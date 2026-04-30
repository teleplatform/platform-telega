import assert from "node:assert/strict";
import { estimateExecutionBudget, checkExecutionBudget, buildBudgetDecisionSummary } from "../../../packages/runtime-economics-core/src/budget/budgetGuard.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

const defaultBudget = {
  max_tokens_per_task: 50000,
  max_tools_per_task: 5,
  max_retries: 3,
  max_fanout: 3,
  max_agent_chain_depth: 5,
  max_total_cost_estimate: 10.0,
};

console.log("\nBudget Guard:");

test("low complexity task passes budget check", () => {
  const estimate = estimateExecutionBudget({ estimated_tokens: 5000, estimated_cost: 0.1 }, { complexity: "low", execution_mode: "single_call" }, { cost_tier: "low" });
  const decision = checkExecutionBudget({ estimated_tokens: estimate.estimated_tokens, estimated_cost: estimate.estimated_cost }, defaultBudget);
  assert.equal(decision.allowed, true);
});

test("high complexity multi-agent task estimated higher", () => {
  const low = estimateExecutionBudget({}, { complexity: "low", execution_mode: "single_call" }, { cost_tier: "low" });
  const high = estimateExecutionBudget({}, { complexity: "high", execution_mode: "multi_agent" }, { cost_tier: "high" });
  assert.ok(high.estimated_tokens > low.estimated_tokens);
});

test("token overage denied", () => {
  const decision = checkExecutionBudget({ estimated_tokens: 100000 }, defaultBudget);
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons[0].includes("tokens_exceeded"));
});

test("cost overage denied", () => {
  const decision = checkExecutionBudget({ estimated_cost: 20.0 }, defaultBudget);
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons[0].includes("cost_exceeded"));
});

test("tools overage denied", () => {
  const decision = checkExecutionBudget({ expected_tools: 10 }, defaultBudget);
  assert.equal(decision.allowed, false);
});

test("chain depth overage denied", () => {
  const decision = checkExecutionBudget({ expected_chain_depth: 10 }, defaultBudget);
  assert.equal(decision.allowed, false);
});

test("budget decision summary is readable", () => {
  const decision = checkExecutionBudget({ estimated_tokens: 100000 }, defaultBudget);
  const summary = buildBudgetDecisionSummary(decision);
  assert.ok(summary.includes("Budget check failed"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
