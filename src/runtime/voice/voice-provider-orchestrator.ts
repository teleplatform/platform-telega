/**
 * TGR-6.33 — Voice Provider Orchestrator
 *
 * Same runtime principles as text ProviderOrchestrator:
 *   health → scoring → fallback → metrics → trace
 *
 * Canon: Tele•GPT is the brain. Voice providers are replaceable adapters.
 */

import type {
  VoiceProviderId,
  VoiceOrchestratorRequest,
  VoiceOrchestratorDecision,
  VoiceProviderScore,
  VoiceExecutionTrace,
  VoiceHealthStatus,
} from "./voice-provider.types.js";
import { VoiceProviderRegistry, getVoiceFallbackChain } from "./voice-provider-registry.js";
import { probeAllVoiceProviders, invalidateVoiceHealthCache } from "./voice-health-probe.js";
import {
  recordVoiceSuccess,
  recordVoiceFailure,
  getVoiceSuccessRate,
  getVoiceAvgLatency,
  getVoiceFailureStreak,
  computeVoiceConfidence,
  getVoiceMetrics,
  voiceFailureStreakPenalty,
} from "./voice-provider-metrics.js";

// ─── Scoring ──────────────────────────────────────────────────────────────────

const HEALTH_MODIFIER: Record<VoiceHealthStatus, number> = {
  healthy:     +20,
  degraded:    -20,
  unavailable: -1000,
  unknown:       0,
};

const COST_PENALTY: Record<string, number> = {
  free: 0, low: -5, medium: -10, high: -20,
};

const LATENCY_BONUS: Record<string, number> = {
  fast: +10, normal: 0, slow: -10,
};

const QUALITY_BONUS: Record<string, number> = {
  high: +10, good: +5, basic: 0,
};

function scoreVoiceProvider(
  profile: ReturnType<VoiceProviderRegistry["get"]>,
  health: VoiceHealthStatus,
  healthReason: string,
  req: VoiceOrchestratorRequest
): VoiceProviderScore {
  if (!profile) {
    return { provider: "local_tts", score: -9999, available: false, healthStatus: "unavailable", healthReason: "not_found", reasons: [] };
  }

  const reasons: string[] = [];
  let score = 0;

  // Health gate
  const healthMod = HEALTH_MODIFIER[health];
  score += healthMod;
  reasons.push(`health:${health}(${healthReason}):${healthMod >= 0 ? "+" : ""}${healthMod}`);

  if (health === "unavailable") {
    return { provider: profile.id, score, available: false, healthStatus: health, healthReason, reasons };
  }

  // Task kind match (+30)
  if (profile.taskKind.includes(req.taskKind)) {
    score += 30;
    reasons.push(`task_match:+30`);
  } else {
    score -= 1000;
    reasons.push(`task_mismatch:-1000`);
    return { provider: profile.id, score, available: false, healthStatus: health, healthReason, reasons };
  }

  // Language match (+30)
  const lang = req.language ?? "ru";
  if (profile.languages.includes(lang)) {
    score += 30;
    reasons.push(`lang_match:+30(${lang})`);
  } else if (profile.languages.includes("*")) {
    score += 10;
    reasons.push(`lang_wildcard:+10`);
  }

  // Privacy / local requirement (+20)
  if (req.requireLocal) {
    if (profile.mode === "local") {
      score += 20;
      reasons.push(`local_match:+20`);
    } else {
      score -= 1000;
      reasons.push(`local_required_but_api:-1000`);
      return { provider: profile.id, score, available: false, healthStatus: health, healthReason, reasons };
    }
  }

  // Streaming requirement (+20)
  if (req.requireStreaming) {
    if (profile.supportsStreaming) {
      score += 20;
      reasons.push(`streaming_match:+20`);
    } else {
      score -= 500;
      reasons.push(`streaming_required_unsupported:-500`);
    }
  }

  // Realtime requirement (+20)
  if (req.requireRealtime) {
    if (profile.supportsRealtime) {
      score += 20;
      reasons.push(`realtime_match:+20`);
    } else {
      score -= 500;
      reasons.push(`realtime_required_unsupported:-500`);
    }
  }

  // Quality tier bonus
  const qualityBonus = QUALITY_BONUS[profile.qualityTier] ?? 0;
  score += qualityBonus;
  if (qualityBonus !== 0) reasons.push(`quality:${profile.qualityTier}:+${qualityBonus}`);

  // Latency tier bonus
  const latencyBonus = LATENCY_BONUS[profile.latencyTier] ?? 0;
  score += latencyBonus;
  if (latencyBonus !== 0) reasons.push(`latency_tier:${profile.latencyTier}:${latencyBonus >= 0 ? "+" : ""}${latencyBonus}`);

  // Cost penalty
  const costPenalty = COST_PENALTY[profile.costTier] ?? 0;
  score += costPenalty;
  if (costPenalty !== 0) reasons.push(`cost:${profile.costTier}:${costPenalty}`);

  // Local mode bonus for non-RU languages — prefer local over API when language is not a Yandex strength
  if (profile.mode === "local" && req.language && !["ru", "uz", "kk"].includes(req.language)) {
    score += 8;
    reasons.push(`local_non_ru_bonus:+8`);
  }

  // Prefer fast (+10)
  if (req.preferFast) {
    const avgLat = getVoiceAvgLatency(profile.id);
    if (avgLat < 2000) { score += 10; reasons.push(`fast_bonus:+10`); }
  }

  // Confidence-adjusted success rate bonus (same as text orchestrator)
  const successRate = getVoiceSuccessRate(profile.id);
  const confidence = computeVoiceConfidence(profile.id);
  const successBonus = successRate * 10 * confidence;
  score += successBonus;
  reasons.push(`success_rate:${successBonus.toFixed(1)}(rate=${successRate.toFixed(2)},conf=${confidence.toFixed(2)})`);

  // Failure streak penalty
  const streak = getVoiceFailureStreak(profile.id);
  const streakPenalty = voiceFailureStreakPenalty(streak);
  if (streakPenalty !== 0) {
    score += streakPenalty;
    reasons.push(`failure_streak:${streakPenalty}(streak=${streak})`);
    if (streakPenalty <= -1000) {
      return { provider: profile.id, score, available: false, healthStatus: "degraded", healthReason: `streak:${streak}`, reasons };
    }
  }

  // Recency bonus
  const m = getVoiceMetrics(profile.id);
  if (m?.lastSuccessAt) {
    const age = Date.now() - m.lastSuccessAt;
    if (age < 5 * 60_000)       { score += 5; reasons.push(`recency:+5(<5min)`); }
    else if (age < 30 * 60_000) { score += 3; reasons.push(`recency:+3(<30min)`); }
    else if (age < 2 * 3600_000){ score += 1; reasons.push(`recency:+1(<2h)`); }
  }

  return {
    provider: profile.id,
    score: Math.round(score),
    available: true,
    healthStatus: health,
    healthReason,
    reasons,
  };
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export class VoiceProviderOrchestrator {
  private static instance: VoiceProviderOrchestrator | null = null;
  private registry = new VoiceProviderRegistry();

  static getInstance(): VoiceProviderOrchestrator {
    if (!this.instance) this.instance = new VoiceProviderOrchestrator();
    return this.instance;
  }

  async decide(req: VoiceOrchestratorRequest): Promise<VoiceOrchestratorDecision> {
    const start = Date.now();

    // Get candidate providers for this task
    const taskBase = req.taskKind.replace("streaming_", "") as "stt" | "tts";
    const candidates = req.preferredProvider
      ? [req.preferredProvider, ...getVoiceFallbackChain(taskBase, req.language, req.requireLocal)
          .filter(p => p !== req.preferredProvider)]
      : getVoiceFallbackChain(taskBase, req.language, req.requireLocal);

    const uniqueCandidates = Array.from(new Set(candidates)) as VoiceProviderId[];

    // Probe health in parallel
    const healthMap = await probeAllVoiceProviders(uniqueCandidates);

    // Score all candidates
    const scores: VoiceProviderScore[] = uniqueCandidates.map(id => {
      const profile = this.registry.get(id);
      const health = healthMap.get(id);
      return scoreVoiceProvider(
        profile,
        health?.status ?? "unknown",
        health?.reason ?? "no_probe",
        req
      );
    });

    scores.sort((a, b) => b.score - a.score);

    const available = scores.filter(s => s.available && s.score > -100);

    if (available.length === 0) {
      // All unavailable — use local_tts/local_whisper as last resort
      const lastResort: VoiceProviderId = taskBase === "stt" ? "local_whisper_stt" : "local_tts";
      console.warn("[voice-orchestrator:all_unavailable]", { taskKind: req.taskKind, lang: req.language });
      return {
        selected: lastResort,
        fallbackChain: [],
        scores,
        traceId: req.traceId,
        decidedAt: Date.now(),
        reason: "all_unavailable_last_resort",
      };
    }

    const selected = available[0].provider;
    const fallbackChain = available.slice(1).map(s => s.provider);

    console.log("[voice-orchestrator:decision]", {
      traceId: req.traceId,
      taskKind: req.taskKind,
      language: req.language,
      selected,
      fallbackChain: fallbackChain.slice(0, 3),
      score: available[0].score,
      decidedInMs: Date.now() - start,
    });

    return {
      selected,
      fallbackChain,
      scores,
      traceId: req.traceId,
      decidedAt: Date.now(),
      reason: `highest_score:${available[0].score}`,
    };
  }

  /**
   * Execute with automatic fallback — same pattern as text executeWithFallback.
   */
  async executeWithFallback(
    req: VoiceOrchestratorRequest,
    executor: (provider: VoiceProviderId, traceId: string) => Promise<{
      success: boolean;
      output?: Buffer | string;
      errorCode?: string;
    }>
  ): Promise<{
    output: Buffer | string | null;
    provider: VoiceProviderId;
    trace: VoiceExecutionTrace;
  }> {
    const decision = await this.decide(req);
    const chain = [decision.selected, ...decision.fallbackChain];

    const trace: VoiceExecutionTrace = {
      traceId: req.traceId,
      request: req,
      decision,
      attempts: [],
      finalProvider: decision.selected,
      totalLatencyMs: 0,
      fallbackCount: 0,
      success: false,
    };

    for (const provider of chain) {
      const attemptStart = Date.now();
      let result: { success: boolean; output?: Buffer | string; errorCode?: string };

      try {
        result = await executor(provider, req.traceId);
      } catch (e: any) {
        result = { success: false, errorCode: e?.message || "exception" };
      }

      const latencyMs = Date.now() - attemptStart;

      if (result.success) {
        recordVoiceSuccess(provider, latencyMs);
      } else {
        recordVoiceFailure(provider, latencyMs, result.errorCode);
      }

      trace.attempts.push({
        provider,
        startedAt: attemptStart,
        finishedAt: Date.now(),
        latencyMs,
        success: result.success,
        errorCode: result.errorCode,
        outputBytes: result.output instanceof Buffer ? result.output.length
          : typeof result.output === "string" ? result.output.length : undefined,
      });
      trace.totalLatencyMs += latencyMs;

      if (result.success && result.output !== undefined) {
        trace.finalProvider = provider;
        trace.success = true;
        trace.fallbackCount = trace.attempts.length - 1;

        console.log("[voice-orchestrator:success]", {
          traceId: req.traceId,
          provider,
          fallbackCount: trace.fallbackCount,
          latencyMs,
        });

        return { output: result.output, provider, trace };
      }

      // Set cooldown on permanent errors
      const errorCode = result.errorCode ?? "";
      if (["missing_key", "invalid_key", "auth"].some(e => errorCode.includes(e))) {
        invalidateVoiceHealthCache(provider);
      }

      console.log("[voice-orchestrator:fallback]", {
        traceId: req.traceId,
        failedProvider: provider,
        errorCode: result.errorCode,
        nextProvider: chain[chain.indexOf(provider) + 1] ?? "none",
      });
    }

    trace.fallbackCount = trace.attempts.length;
    console.error("[voice-orchestrator:all_failed]", {
      traceId: req.traceId,
      chain,
      attempts: trace.attempts.map(a => ({ provider: a.provider, errorCode: a.errorCode })),
    });

    return { output: null, provider: decision.selected, trace };
  }

  invalidateCache(provider: VoiceProviderId): void {
    invalidateVoiceHealthCache(provider);
  }
}

export function getVoiceOrchestrator(): VoiceProviderOrchestrator {
  return VoiceProviderOrchestrator.getInstance();
}
