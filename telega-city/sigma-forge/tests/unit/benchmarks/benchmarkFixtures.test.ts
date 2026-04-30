import assert from "node:assert/strict";
import { getBenchmarkTaskEnvelope, getExpectedBenchmarkShape } from "../../../packages/fsgr-runtime/src/benchmarks/benchmarkFixtures.js";
import { ALL_BENCHMARK_SCENARIOS, getBenchmarkScenario } from "../../../packages/fsgr-runtime/src/benchmarks/benchmarkScenarios.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nBenchmark Fixtures:");

test("all 4 scenarios have fixtures", () => {
  assert.equal(ALL_BENCHMARK_SCENARIOS.length, 4);
});

test("getBenchmarkTaskEnvelope returns valid envelope", () => {
  const envelope = getBenchmarkTaskEnvelope("code_repair_basic");
  assert.ok(envelope.task_id);
  assert.ok(envelope.actor_id);
  assert.ok(envelope.task_kind);
});

test("getExpectedBenchmarkShape returns valid shape", () => {
  const shape = getExpectedBenchmarkShape("code_repair_basic");
  assert.ok(shape.min_nodes > 0);
  assert.ok(shape.max_nodes >= shape.min_nodes);
  assert.ok(shape.final_run_status);
  assert.ok(shape.required_events.length > 0);
});

test("getBenchmarkScenario returns correct scenario", () => {
  const scenario = getBenchmarkScenario("feature_build_bootstrap");
  assert.equal(scenario.scenario_id, "feature_build_bootstrap");
});

test("unknown scenario throws error", () => {
  assert.throws(() => getBenchmarkScenario("unknown" as any));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
