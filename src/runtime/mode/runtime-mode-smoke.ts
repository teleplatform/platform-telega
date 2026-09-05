import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { ProviderRegistry } from "../provider/provider-registry.js";
import { ProviderPolicy } from "../provider/provider-policy.js";
import { registerBuiltinProviders } from "../provider/provider-fixtures.js";
import type { RuntimeAccessMode } from "../provider/provider.types.js";
import type { ProviderRouteRequest } from "../provider/provider-decision.js";

export interface SmokeTestResult {
  mode: RuntimeAccessMode;
  results: Array<{ provider_id: string; access_tier: string; expected: "allowed" | "blocked"; actual: "allowed" | "blocked"; pass: boolean }>;
  passed: boolean;
}

export class RuntimeModeSmoke {
  async run(mode: RuntimeAccessMode, traceId: string): Promise<SmokeTestResult> {
    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, "runtime_mode_smoke_started"),
      trace_id: traceId,
      job_id: "mode",
      type: "runtime_mode_smoke_started" as any,
      timestamp: new Date().toISOString(),
      payload: { mode },
    });

    const registry = new ProviderRegistry();
    registerBuiltinProviders(registry);
    const policy = new ProviderPolicy();

    const testCases: Array<{ provider_id: string; access_tier: string; expected: "allowed" | "blocked" }> = [
      { provider_id: "local:llm", access_tier: "local_model", expected: "allowed" },
      { provider_id: "openai:api", access_tier: "api_model", expected: "allowed" },
      { provider_id: "deepseek:api", access_tier: "api_model", expected: "allowed" },
      { provider_id: "openai:web", access_tier: "creator_web", expected: mode === "creator" ? "allowed" : "blocked" },
      { provider_id: "deepseek:web", access_tier: "creator_web", expected: mode === "creator" ? "allowed" : "blocked" },
      { provider_id: "qwen:web", access_tier: "creator_web", expected: mode === "creator" ? "allowed" : "blocked" },
      { provider_id: "perplexity:web", access_tier: "creator_web", expected: "blocked" },
    ];

    const results: SmokeTestResult["results"] = [];
    let allPassed = true;

    for (const tc of testCases) {
      const profile = registry.get(tc.provider_id);
      if (!profile) {
        results.push({ ...tc, actual: "blocked", pass: false });
        allPassed = false;
        continue;
      }

      const request: ProviderRouteRequest = {
        run_id: "smoke", trace_id: traceId,
        runtime_mode: mode,
        task_kind: "reasoning", intent: "answer", risk_level: "low",
        context: { used_tokens: 100, max_tokens: 4096, has_files: false, has_images: false },
        constraints: { quality: "normal", latency: "normal", cost: "any", privacy: "normal" },
      };

      const check = policy.check(profile, request);
      const actual: "allowed" | "blocked" = check.blocked ? "blocked" : "allowed";
      const pass = actual === tc.expected;

      results.push({ ...tc, actual, pass });
      if (!pass) allPassed = false;
    }

    const result: SmokeTestResult = { mode, results, passed: allPassed };

    await appendEvidenceRecord({
      evidence_id: hashTraceId(traceId, allPassed ? "runtime_mode_smoke_completed" : "runtime_mode_smoke_failed"),
      trace_id: traceId,
      job_id: "mode",
      type: (allPassed ? "runtime_mode_smoke_completed" : "runtime_mode_smoke_failed") as any,
      timestamp: new Date().toISOString(),
      payload: {
        mode,
        passed: allPassed,
        total: results.length,
        passed_count: results.filter((r) => r.pass).length,
        failed_count: results.filter((r) => !r.pass).length,
      },
    });

    return result;
  }

  formatResults(results: SmokeTestResult[]): string {
    let output = "## Runtime Mode Smoke Check\n\n";

    for (const r of results) {
      output += `### ${r.mode}\n`;
      for (const tr of r.results) {
        const icon = tr.pass ? "✅" : "❌";
        output += `- ${icon} \`${tr.provider_id}\` (${tr.access_tier}): ${tr.actual} (expected: ${tr.expected})\n`;
      }
      output += "\n";
    }

    const allPassed = results.every((r) => r.passed);
    output += `**Status:** ${allPassed ? "✅ PASS" : "❌ FAIL"}`;

    return output;
  }
}
