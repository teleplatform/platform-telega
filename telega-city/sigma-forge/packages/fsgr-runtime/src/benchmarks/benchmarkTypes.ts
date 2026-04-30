export type BenchmarkScenarioId =
  | "code_repair_basic"
  | "feature_build_bootstrap"
  | "research_to_artifact_bootstrap"
  | "ops_retry_and_resume";

export interface BenchmarkScenario {
  scenario_id: BenchmarkScenarioId;
  title: string;
  description: string;
  task_input: Record<string, unknown>;
  expected: {
    selected_families: string[];
    min_nodes: number;
    max_nodes: number;
    final_run_status: "completed" | "degraded" | "failed";
    required_events: string[];
  };
}

export interface BenchmarkRunResult {
  scenario_id: BenchmarkScenarioId;
  ok: boolean;
  final_run_status: string;
  node_count: number;
  event_types: string[];
  artifact_count: number;
  duration_ms: number;
  checks: Array<{
    name: string;
    ok: boolean;
    summary: string;
  }>;
}

export interface BenchmarkReport {
  benchmark_version: string;
  total: number;
  passed: number;
  failed: number;
  results: BenchmarkRunResult[];
  generated_at: string;
}
