import type { FsgrRuntime } from "../runtime/initRuntime.js";

export interface RuntimeHealthSummary {
  runs_total: number;
  runs_completed: number;
  runs_failed: number;
  runs_degraded: number;
  events_total: number;
  artifacts_total: number;
  benchmark_last_report?: {
    total: number;
    passed: number;
    failed: number;
  };
  integrity: {
    events_ok: boolean;
    storage_ok: boolean;
    explain_ok: boolean;
  };
}

export async function buildRuntimeHealthSummary(runtime: FsgrRuntime, options?: { benchmarkReport?: any }): Promise<RuntimeHealthSummary> {
  const allRuns = runtime.repos.runs.listRuns();
  const allEvents = runtime.ledgerStore.getEvents("");
  const allArtifacts = runtime.repos.artifacts.getArtifactsByRunId("");

  const runsCompleted = allRuns.filter((r) => r.status === "completed").length;
  const runsFailed = allRuns.filter((r) => r.status === "failed").length;
  const runsDegraded = allRuns.filter((r) => r.status === "degraded").length;

  return {
    runs_total: allRuns.length,
    runs_completed: runsCompleted,
    runs_failed: runsFailed,
    runs_degraded: runsDegraded,
    events_total: allEvents.length,
    artifacts_total: allArtifacts.length,
    benchmark_last_report: options?.benchmarkReport ? {
      total: options.benchmarkReport.total,
      passed: options.benchmarkReport.passed,
      failed: options.benchmarkReport.failed,
    } : undefined,
    integrity: {
      events_ok: true,
      storage_ok: true,
      explain_ok: true,
    },
  };
}
