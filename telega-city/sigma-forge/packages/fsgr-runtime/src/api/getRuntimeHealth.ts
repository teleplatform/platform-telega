import type { FsgrRuntime } from "../runtime/initRuntime.js";
import { buildRuntimeHealthSummary, type RuntimeHealthSummary } from "../hardening/healthSummary.js";

export async function getFsgrRuntimeHealth(runtime: FsgrRuntime): Promise<RuntimeHealthSummary> {
  return buildRuntimeHealthSummary(runtime, { benchmarkReport: runtime.lastBenchmarkReport });
}
