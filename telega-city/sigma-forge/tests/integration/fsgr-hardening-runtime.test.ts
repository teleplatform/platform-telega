import assert from "node:assert/strict";
import { initFsgrRuntime } from "../../packages/fsgr-runtime/src/runtime/initRuntime.js";
import { runFsgrBenchmarks } from "../../packages/fsgr-runtime/src/api/runBenchmarks.js";
import { getFsgrBenchmarkReport } from "../../packages/fsgr-runtime/src/api/getBenchmarkReport.js";
import { getFsgrRuntimeHealth } from "../../packages/fsgr-runtime/src/api/getRuntimeHealth.js";

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const result = fn();
    if (result instanceof Promise) {
      return result.then(() => {
        passed++;
        console.log(`  ✓ ${name}`);
      }).catch((e) => {
        failed++;
        console.error(`  ✗ ${name}\n    ${e.message}`);
      });
    }
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}\n    ${e.message}`);
  }
}

async function runTests() {
  console.log("\nIntegration: FSGR Benchmark Code Repair:");

  await test("code_repair_basic scenario executes", async () => {
    const runtime = initFsgrRuntime();
    const report = await runFsgrBenchmarks(runtime);
    const codeRepair = report.results.find((r) => r.scenario_id === "code_repair_basic");
    assert.ok(codeRepair);
    assert.equal(codeRepair!.ok, true);
    assert.equal(codeRepair!.final_run_status, "completed");
  });

  await test("benchmark report stored/returned", async () => {
    const runtime = initFsgrRuntime();
    await runFsgrBenchmarks(runtime);
    const report = getFsgrBenchmarkReport(runtime);
    assert.ok(report);
    assert.equal(report!.total, 4);
  });

  console.log("\nIntegration: FSGR Hardening Runtime:");

  await test("runtime health summary works", async () => {
    const runtime = initFsgrRuntime();
    const health = await getFsgrRuntimeHealth(runtime);
    assert.ok(health.runs_total >= 0);
    assert.ok(health.integrity.events_ok);
    assert.ok(health.integrity.storage_ok);
    assert.ok(health.integrity.explain_ok);
  });

  await test("event/storage/explain integrity validators usable on real runs", async () => {
    const runtime = initFsgrRuntime();
    const report = await runFsgrBenchmarks(runtime);
    assert.ok(report.total > 0);
    assert.ok(report.passed > 0);
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
