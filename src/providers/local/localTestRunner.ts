import { LOCAL_MODELS, LocalModelEntry } from"./localModels.js";
import { callLocalProvider, LocalProviderResult } from"./localProvider.js";
import { BENCHMARK_PROMPTS, FAST_TEST_PROMPT, BenchmarkPrompt } from"./localBenchmarkPrompts.js";
import { writeLocalProviderEvidence } from"./localEvidence.js";
import { checkLocalHealth, LocalHealthResult } from"./localHealthCheck.js";

export interface LocalModelTestResult {
  providerId: string;
  modelName: string;
  transport: string;
  health: { ok: boolean; error?: string };
  tests: Array<{
    promptId: string;
    label: string;
    latencyMs: number;
    outputLength: number;
    success: boolean;
    error?: string;
  }>;
  overall: "pass" | "partial" | "fail";
  totalLatencyMs: number;
}

export interface LocalBenchmarkReport {
  startedAt: string;
  completedAt: string;
  health: LocalHealthResult;
  results: LocalModelTestResult[];
  summary: {
    total: number;
    passed: number;
    partial: number;
    failed: number;
    fastModel: string | null;
    bestLatency: { providerId: string; latencyMs: number } | null;
  };
}

async function testSingleModel(
  entry: LocalModelEntry,
  prompts: BenchmarkPrompt[],
  signal?: AbortSignal
): Promise<LocalModelTestResult> {
  const tests: LocalModelTestResult["tests"] = [];
  let failures = 0;

  for (const prompt of prompts) {
    if (signal?.aborted) {
      tests.push({
        promptId: prompt.id,
        label: prompt.label,
        latencyMs: 0,
        outputLength: 0,
        success: false,
        error: "aborted",
      });
      failures++;
      continue;
    }

    const t0 = Date.now();
    try {
      writeLocalProviderEvidence("local_benchmark_model_started", entry.id, entry.name, entry.transport, {
        promptId: prompt.id,
      });

      const result = await callLocalProvider({
        providerId: entry.id.split(":")[1] || entry.id,
        prompt: prompt.prompt,
      });

      const latencyMs = Date.now() - t0;
      const outputLength = result.text.length;

      const success = outputLength >= prompt.minExpectedLength;

      writeLocalProviderEvidence("local_benchmark_model_completed", entry.id, entry.name, entry.transport, {
        promptId: prompt.id,
        latencyMs,
        outputLength,
        success,
      });

      tests.push({
        promptId: prompt.id,
        label: prompt.label,
        latencyMs,
        outputLength,
        success,
      });

      if (!success) failures++;
    } catch (e) {
      const latencyMs = Date.now() - t0;
      const errMsg = (e as Error).message;

      writeLocalProviderEvidence("local_benchmark_model_failed", entry.id, entry.name, entry.transport, {
        promptId: prompt.id,
        error: errMsg,
        latencyMs,
      });

      tests.push({
        promptId: prompt.id,
        label: prompt.label,
        latencyMs,
        outputLength: 0,
        success: false,
        error: errMsg,
      });
      failures++;
    }
  }

  const totalLatencyMs = tests.reduce((s, t) => s + t.latencyMs, 0);

  return {
    providerId: entry.id,
    modelName: entry.name,
    transport: entry.transport,
    health: { ok: true },
    tests,
    overall: failures === 0 ? "pass" : failures < tests.length ? "partial" : "fail",
    totalLatencyMs,
  };
}

export async function runSingleModelTest(providerId: string): Promise<LocalModelTestResult | null> {
  const entry = LOCAL_MODELS[providerId];
  if (!entry) return null;

  writeLocalProviderEvidence("local_benchmark_started", entry.id, entry.name, entry.transport);
  const result = await testSingleModel(entry, [FAST_TEST_PROMPT, ...BENCHMARK_PROMPTS]);
  writeLocalProviderEvidence("local_benchmark_completed", entry.id, entry.name, entry.transport, {
    overall: result.overall,
    totalLatencyMs: result.totalLatencyMs,
  });

  return result;
}

export async function runAllLocalModelTests(): Promise<LocalBenchmarkReport> {
  const startedAt = new Date().toISOString();
  const health = await checkLocalHealth();

  writeLocalProviderEvidence("local_benchmark_started", "all", "All Models", "ollama");

  const results: LocalModelTestResult[] = [];
  for (const [providerId, entry] of Object.entries(LOCAL_MODELS)) {
    const result = await testSingleModel(entry, [FAST_TEST_PROMPT]);
    results.push(result);
  }

  const passed = results.filter((r) => r.overall === "pass").length;
  const partial = results.filter((r) => r.overall === "partial").length;
  const failed = results.filter((r) => r.overall === "fail").length;

  // Find fastest model
  const sortedByLatency = [...results]
    .filter((r) => r.tests.length > 0 && r.tests[0].success)
    .sort((a, b) => a.tests[0].latencyMs - b.tests[0].latencyMs);

  const fastModel = sortedByLatency.length > 0 ? sortedByLatency[0].providerId : null;
  const bestLatency = sortedByLatency.length > 0
    ? { providerId: sortedByLatency[0].providerId, latencyMs: sortedByLatency[0].tests[0].latencyMs }
    : null;

  writeLocalProviderEvidence("local_benchmark_completed", "all", "All Models", "ollama", {
    passed,
    partial,
    failed,
  });

  return {
    startedAt,
    completedAt: new Date().toISOString(),
    health,
    results,
    summary: { total: results.length, passed, partial, failed, fastModel, bestLatency },
  };
}
