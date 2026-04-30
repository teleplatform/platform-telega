import type { BenchmarkRunResult, BenchmarkReport } from "./benchmarkTypes.js";

export function buildBenchmarkReport(results: BenchmarkRunResult[]): BenchmarkReport {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return {
    benchmark_version: "1.0.0",
    total: results.length,
    passed,
    failed,
    results,
    generated_at: new Date().toISOString(),
  };
}

export function summarizeBenchmarkFailures(results: BenchmarkRunResult[]): Array<{ scenario_id: string; failed_checks: string[] }> {
  return results
    .filter((r) => !r.ok)
    .map((r) => ({
      scenario_id: r.scenario_id,
      failed_checks: r.checks.filter((c) => !c.ok).map((c) => c.name),
    }));
}
