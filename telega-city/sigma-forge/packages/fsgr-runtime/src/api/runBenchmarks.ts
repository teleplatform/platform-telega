import type { FsgrRuntime } from "../runtime/initRuntime.js";
import type { BenchmarkScenarioId, BenchmarkRunResult, BenchmarkReport } from "../benchmarks/benchmarkTypes.js";
import { runBenchmarkScenario, runAllBenchmarks } from "../benchmarks/benchmarkRunner.js";
import { buildBenchmarkReport } from "../benchmarks/benchmarkReport.js";

export async function runFsgrBenchmarks(runtime: FsgrRuntime): Promise<BenchmarkReport> {
  const results = await runAllBenchmarks(runtime);
  const report = buildBenchmarkReport(results);
  runtime.lastBenchmarkReport = report;
  return report;
}

export async function runFsgrBenchmarkScenario(runtime: FsgrRuntime, scenario_id: BenchmarkScenarioId): Promise<BenchmarkRunResult> {
  const result = await runBenchmarkScenario(runtime, scenario_id);
  return result;
}
