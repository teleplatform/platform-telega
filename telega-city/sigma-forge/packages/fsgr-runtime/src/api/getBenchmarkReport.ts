import type { FsgrRuntime } from "../runtime/initRuntime.js";
import type { BenchmarkReport } from "../benchmarks/benchmarkTypes.js";

export function getFsgrBenchmarkReport(runtime: FsgrRuntime): BenchmarkReport | null {
  return runtime.lastBenchmarkReport ?? null;
}
