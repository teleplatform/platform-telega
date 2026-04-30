import type { FsgrRuntime } from "../runtime/initRuntime.js";
import type { BenchmarkScenarioId, BenchmarkRunResult, BenchmarkReport } from "./benchmarkTypes.js";
import { getBenchmarkTaskEnvelope, getExpectedBenchmarkShape } from "./benchmarkFixtures.js";
import { ALL_BENCHMARK_SCENARIOS, getBenchmarkScenario } from "./benchmarkScenarios.js";
import { startFsgrRun } from "../api/startRun.js";
import { executeFsgrRun } from "../api/executeRun.js";
import { getFsgrRun } from "../api/getRun.js";
import { getFsgrRunExplain } from "../api/getRunExplain.js";

export async function runBenchmarkScenario(runtime: FsgrRuntime, scenario_id: BenchmarkScenarioId): Promise<BenchmarkRunResult> {
  const scenario = getBenchmarkScenario(scenario_id);
  const expected = scenario.expected;
  const startTime = Date.now();
  const checks: BenchmarkRunResult["checks"] = [];

  try {
    const startResult = await startFsgrRun(runtime, scenario.task_input as any);
    checks.push({ name: "run_created", ok: !!startResult.ledger.run_id, summary: `Run ${startResult.ledger.run_id} created` });
    checks.push({ name: "graph_created", ok: !!startResult.graph, summary: `Graph with ${startResult.graph.nodes.length} nodes created` });

    const execResult = await executeFsgrRun(runtime, startResult.ledger.run_id);
    checks.push({ name: "execution_completed", ok: true, summary: `Execution finished: ${execResult.status}` });

    const run = getFsgrRun(runtime, startResult.ledger.run_id);
    const explain = getFsgrRunExplain(runtime, startResult.ledger.run_id);

    const events = runtime.ledgerStore.getEvents(startResult.ledger.run_id);
    const eventTypes = events.map((e) => e.event_type as string);
    const artifacts = runtime.repos.artifacts.getArtifactsByRunId(startResult.ledger.run_id);

    checks.push({
      name: "node_count_in_range",
      ok: startResult.graph.nodes.length >= expected.min_nodes && startResult.graph.nodes.length <= expected.max_nodes,
      summary: `Node count ${startResult.graph.nodes.length} in range [${expected.min_nodes}, ${expected.max_nodes}]`,
    });

    const requiredEventsPresent = expected.required_events.every((req) => eventTypes.includes(req));
    checks.push({
      name: "required_events_present",
      ok: requiredEventsPresent,
      summary: requiredEventsPresent ? "All required events present" : `Missing events: ${expected.required_events.filter((req) => !eventTypes.includes(req)).join(", ")}`,
    });

    checks.push({
      name: "final_status_matches",
      ok: execResult.status === expected.final_run_status,
      summary: `Final status: ${execResult.status}, expected: ${expected.final_run_status}`,
    });

    checks.push({
      name: "explain_available",
      ok: !!(explain as any)?.ok,
      summary: "Explain available" ,
    });

    const durationMs = Date.now() - startTime;

    const allPassed = checks.every((c) => c.ok);

    return {
      scenario_id,
      ok: allPassed,
      final_run_status: execResult.status,
      node_count: startResult.graph.nodes.length,
      event_types: eventTypes,
      artifact_count: artifacts.length,
      duration_ms: durationMs,
      checks,
    };
  } catch (e: any) {
    const durationMs = Date.now() - startTime;
    checks.push({ name: "execution_error", ok: false, summary: e.message });
    return {
      scenario_id,
      ok: false,
      final_run_status: "failed",
      node_count: 0,
      event_types: [],
      artifact_count: 0,
      duration_ms: durationMs,
      checks,
    };
  }
}

export async function runAllBenchmarks(runtime: FsgrRuntime): Promise<BenchmarkRunResult[]> {
  const results: BenchmarkRunResult[] = [];
  for (const scenario of ALL_BENCHMARK_SCENARIOS) {
    const result = await runBenchmarkScenario(runtime, scenario.scenario_id);
    results.push(result);
  }
  return results;
}
