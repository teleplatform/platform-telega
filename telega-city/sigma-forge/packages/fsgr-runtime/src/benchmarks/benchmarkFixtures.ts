import type { BenchmarkScenario, BenchmarkScenarioId } from "./benchmarkTypes.js";

export const BENCHMARK_FIXTURES: Record<BenchmarkScenarioId, BenchmarkScenario> = {
  code_repair_basic: {
    scenario_id: "code_repair_basic",
    title: "Code Repair Basic",
    description: "Fix a simple UI regression",
    task_input: {
      task_id: "bench_code_repair",
      actor_id: "benchmark",
      actor_mode: "creator",
      intent_key: "fix",
      task_kind: "ui_fix",
      goal: "Fix UI regression in component",
      constraints: [],
      execution_mode: "fast",
    },
    expected: {
      selected_families: ["frontend", "ops"],
      min_nodes: 1,
      max_nodes: 3,
      final_run_status: "completed",
      required_events: ["run.created", "plan.built", "node.started", "node.completed", "run.completed"],
    },
  },
  feature_build_bootstrap: {
    scenario_id: "feature_build_bootstrap",
    title: "Feature Build Bootstrap",
    description: "Build a new API endpoint",
    task_input: {
      task_id: "bench_feature_build",
      actor_id: "benchmark",
      actor_mode: "creator",
      intent_key: "build",
      task_kind: "api_build",
      goal: "Build new API endpoint with validation",
      constraints: [],
      execution_mode: "safe",
    },
    expected: {
      selected_families: ["backend", "ops"],
      min_nodes: 1,
      max_nodes: 4,
      final_run_status: "completed",
      required_events: ["run.created", "plan.built", "node.started", "node.completed", "run.completed"],
    },
  },
  research_to_artifact_bootstrap: {
    scenario_id: "research_to_artifact_bootstrap",
    title: "Research to Artifact",
    description: "Analyze and synthesize research findings",
    task_input: {
      task_id: "bench_research",
      actor_id: "benchmark",
      actor_mode: "creator",
      intent_key: "research",
      task_kind: "research_compare",
      goal: "Compare and synthesize research findings",
      constraints: [],
      execution_mode: "quality",
    },
    expected: {
      selected_families: ["research", "content"],
      min_nodes: 1,
      max_nodes: 5,
      final_run_status: "completed",
      required_events: ["run.created", "plan.built", "node.started", "node.completed", "run.completed"],
    },
  },
  ops_retry_and_resume: {
    scenario_id: "ops_retry_and_resume",
    title: "Ops Retry and Resume",
    description: "Run tests with retry capability",
    task_input: {
      task_id: "bench_ops",
      actor_id: "benchmark",
      actor_mode: "creator",
      intent_key: "test",
      task_kind: "test_run",
      goal: "Run test suite with validation",
      constraints: [],
      execution_mode: "safe",
    },
    expected: {
      selected_families: ["ops"],
      min_nodes: 1,
      max_nodes: 3,
      final_run_status: "completed",
      required_events: ["run.created", "plan.built", "node.started", "node.completed", "run.completed"],
    },
  },
};

export function getBenchmarkTaskEnvelope(scenario_id: BenchmarkScenarioId): Record<string, unknown> {
  return BENCHMARK_FIXTURES[scenario_id].task_input;
}

export function getExpectedBenchmarkShape(scenario_id: BenchmarkScenarioId): BenchmarkScenario["expected"] {
  return BENCHMARK_FIXTURES[scenario_id].expected;
}
