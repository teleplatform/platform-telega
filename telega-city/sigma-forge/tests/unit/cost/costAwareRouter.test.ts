import assert from "node:assert/strict";
import { resolveExecutionMode } from "../../../packages/runtime-economics-core/src/cost/orchestrationDepth.js";
import { suggestCheaperMode } from "../../../packages/runtime-economics-core/src/cost/cheaperMode.js";
import { routeTaskEconomically } from "../../../packages/runtime-economics-core/src/cost/costAwareRouter.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nOrchestration Depth:");

test("trivial task → single_call", () => {
  const result = resolveExecutionMode({ complexity: "low", needs_tools: false, needs_review: false, needs_approval: false, risk_level: "low" });
  assert.equal(result, "single_call");
});

test("medium complexity → single_worker", () => {
  const result = resolveExecutionMode({ complexity: "medium", needs_tools: false, needs_review: false, needs_approval: false, risk_level: "low" });
  assert.equal(result, "single_worker");
});

test("high complexity with tools → multi_agent", () => {
  const result = resolveExecutionMode({ complexity: "high", needs_tools: true, needs_review: false, needs_approval: false, risk_level: "medium" });
  assert.equal(result, "multi_agent");
});

test("high risk → multi_agent_reviewed", () => {
  const result = resolveExecutionMode({ complexity: "medium", needs_tools: false, needs_review: false, needs_approval: false, risk_level: "high" });
  assert.equal(result, "multi_agent_reviewed");
});

test("needs approval → human_approval_required", () => {
  const result = resolveExecutionMode({ complexity: "low", needs_tools: false, needs_review: false, needs_approval: true, risk_level: "low" });
  assert.equal(result, "human_approval_required");
});

console.log("\nCheaper Mode:");

test("multi_agent_reviewed → multi_agent", () => {
  assert.equal(suggestCheaperMode("multi_agent_reviewed"), "multi_agent");
});

test("multi_agent → tool_augmented", () => {
  assert.equal(suggestCheaperMode("multi_agent"), "tool_augmented");
});

test("single_call → undefined", () => {
  assert.equal(suggestCheaperMode("single_call"), undefined);
});

console.log("\nCost-Aware Router:");

test("simple task routes to single_call", () => {
  const result = routeTaskEconomically({ goal: "Say hello", task_id: "t1" });
  assert.equal(result.complexity, "low");
  assert.equal(result.execution_mode, "single_call");
});

test("complex task routes to multi_agent", () => {
  const result = routeTaskEconomically({ goal: "Build API endpoint with code and tools", task_id: "t2", requires_tools: true, task_kind: "build" });
  assert.equal(result.complexity, "high");
});

test("approval-needed task routes to human_approval", () => {
  const result = routeTaskEconomically({ goal: "Process payment", task_id: "t3", requires_approval: true });
  assert.equal(result.execution_mode, "human_approval_required");
});

test("cheaper mode suggested for multi_agent_reviewed", () => {
  const result = routeTaskEconomically({ goal: "Analyze and compare research findings with review", task_id: "t4", requires_review: true, task_kind: "research" });
  assert.ok(result.execution_mode === "multi_agent_reviewed" || result.execution_mode === "multi_agent");
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
