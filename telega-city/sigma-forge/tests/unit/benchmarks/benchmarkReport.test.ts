import assert from "node:assert/strict";
import { buildBenchmarkReport, summarizeBenchmarkFailures } from "../../../packages/fsgr-runtime/src/benchmarks/benchmarkReport.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e: any) { failed++; console.error(`  ✗ ${name}\n    ${e.message}`); }
}

console.log("\nBenchmark Report:");

test("build report with all passing", () => {
  const results = [
    { scenario_id: "code_repair_basic" as const, ok: true, final_run_status: "completed", node_count: 2, event_types: ["run.created"], artifact_count: 1, duration_ms: 100, checks: [] },
    { scenario_id: "feature_build_bootstrap" as const, ok: true, final_run_status: "completed", node_count: 3, event_types: ["run.created"], artifact_count: 2, duration_ms: 200, checks: [] },
  ];
  const report = buildBenchmarkReport(results);
  assert.equal(report.total, 2);
  assert.equal(report.passed, 2);
  assert.equal(report.failed, 0);
  assert.ok(report.generated_at);
});

test("build report with failures", () => {
  const results = [
    { scenario_id: "code_repair_basic" as const, ok: true, final_run_status: "completed", node_count: 2, event_types: [], artifact_count: 1, duration_ms: 100, checks: [] },
    { scenario_id: "feature_build_bootstrap" as const, ok: false, final_run_status: "failed", node_count: 0, event_types: [], artifact_count: 0, duration_ms: 50, checks: [{ name: "node_count", ok: false, summary: "0 < 1" }] },
  ];
  const report = buildBenchmarkReport(results);
  assert.equal(report.total, 2);
  assert.equal(report.passed, 1);
  assert.equal(report.failed, 1);
});

test("summarizeBenchmarkFailures returns failed checks", () => {
  const results = [
    { scenario_id: "ops_retry_and_resume" as const, ok: false, final_run_status: "degraded", node_count: 0, event_types: [], artifact_count: 0, duration_ms: 50, checks: [{ name: "node_count", ok: false, summary: "0 < 1" }, { name: "events", ok: false, summary: "missing" }] },
  ];
  const failures = summarizeBenchmarkFailures(results);
  assert.equal(failures.length, 1);
  assert.equal(failures[0].failed_checks.length, 2);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
