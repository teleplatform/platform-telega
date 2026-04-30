import type { BenchmarkScenario, BenchmarkScenarioId } from "./benchmarkTypes.js";
import { BENCHMARK_FIXTURES } from "./benchmarkFixtures.js";

export const ALL_BENCHMARK_SCENARIOS: BenchmarkScenario[] = Object.values(BENCHMARK_FIXTURES);

export function getBenchmarkScenario(id: BenchmarkScenarioId): BenchmarkScenario {
  const scenario = BENCHMARK_FIXTURES[id];
  if (!scenario) throw new Error(`Unknown benchmark scenario: ${id}`);
  return scenario;
}
