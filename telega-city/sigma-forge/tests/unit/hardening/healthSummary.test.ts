import assert from "node:assert/strict";
import { initFsgrRuntime } from "../../../packages/fsgr-runtime/src/runtime/initRuntime.js";
import { buildRuntimeHealthSummary } from "../../../packages/fsgr-runtime/src/hardening/healthSummary.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nHealth Summary:");

test("buildRuntimeHealthSummary returns valid summary", async () => {
  const runtime = initFsgrRuntime();
  const summary = await buildRuntimeHealthSummary(runtime);
  assert.ok(summary.runs_total >= 0);
  assert.ok(summary.runs_completed >= 0);
  assert.ok(summary.runs_failed >= 0);
  assert.ok(summary.runs_degraded >= 0);
  assert.ok(summary.events_total >= 0);
  assert.ok(summary.artifacts_total >= 0);
  assert.ok(summary.integrity.events_ok);
  assert.ok(summary.integrity.storage_ok);
  assert.ok(summary.integrity.explain_ok);
});

test("health summary includes benchmark report when available", async () => {
  const runtime = initFsgrRuntime();
  runtime.lastBenchmarkReport = { benchmark_version: "1.0.0", total: 4, passed: 3, failed: 1, results: [], generated_at: "2024-01-01T00:00:00Z" };
  const summary = await buildRuntimeHealthSummary(runtime, { benchmarkReport: runtime.lastBenchmarkReport });
  assert.ok(summary.benchmark_last_report);
  assert.equal(summary.benchmark_last_report.total, 4);
  assert.equal(summary.benchmark_last_report.passed, 3);
  assert.equal(summary.benchmark_last_report.failed, 1);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
