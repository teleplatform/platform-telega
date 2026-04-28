/**
 * Voice Runtime Governance Integration — V12.4–V12.8
 *
 * Wires together:
 *   V12.4 — VoiceRuntimeGovernanceGate (message gating)
 *   V12.5 — VoiceFeatureFlagGovernance (feature flags)
 *   V12.6 — VoiceSafeRoutingFailover (routing + failover)
 *   V12.7 — VoiceSecretInjectionGuard (secret security)
 *   V12.8 — VoiceRuntimeTraceLayer (audit trace)
 *
 * Full pipeline:
 *   message → governance gate → routing decision → (secret injection) → execute → trace
 */

// ============================================================================
// Re-exports
// ============================================================================

export type {
  VoiceRuntimeGovernanceGate,
  VoiceMessageType,
  VoiceGateCheck,
} from "./voiceRuntimeGovernanceGate.js";

export type {
  VoiceFeatureFlags,
} from "./voiceFeatureFlagGovernance.js";

export type {
  VoiceRoutingDecision,
  VoiceRoutingReason,
  VoiceRoutingResult,
} from "./voiceSafeRoutingFailover.js";

export type {
  VoiceSecretInjectionGuard,
  VoiceSecurityConstraint,
} from "./voiceSecretInjectionGuard.js";

export type {
  VoiceRuntimeTrace,
  VoiceTraceResultStatus,
  VoiceTraceStatistics,
} from "./voiceRuntimeTraceLayer.js";

// ============================================================================
// Core imports
// ============================================================================

import {
  evaluateGovernanceGate,
  type VoiceGovernanceGateInput,
} from "./voiceRuntimeGovernanceGate.js";

import {
  makeRoutingDecision,
  type VoiceRoutingInput,
  getCachedHealth,
  updateCachedHealth,
} from "./voiceSafeRoutingFailover.js";

import {
  evaluateSecretInjectionGuard,
  maskSecretValue,
  type VoiceInjectionGuardInput,
} from "./voiceSecretInjectionGuard.js";

import {
  recordTrace,
  createTrace,
  getTraceStatistics,
  type VoiceCreateTraceInput,
} from "./voiceRuntimeTraceLayer.js";

import type { VoiceFeatureFlags } from "./voiceFeatureFlagGovernance.js";

// ============================================================================
// Integration pipeline
// ============================================================================

export interface VoiceRuntimeGovernancePipelineInput {
  message: string;
  userId: string;
  flags: VoiceFeatureFlags;
  teleGPTHealthyOverride?: boolean;
}

export interface VoiceRuntimeGovernancePipelineResult {
  gate: ReturnType<typeof evaluateGovernanceGate>;
  routing: ReturnType<typeof makeRoutingDecision>;
  shouldInjectSecrets: boolean;
  traceId: string;
}

/**
 * Execute the full runtime governance pipeline.
 *
 * Pipeline flow:
 *   1. Evaluate governance gate (V12.4)
 *   2. Make routing decision (V12.6)
 *   3. Check secret injection policy (V12.7)
 *   4. Record trace (V12.8)
 */
export function executeRuntimeGovernancePipeline(
  input: VoiceRuntimeGovernancePipelineInput,
): VoiceRuntimeGovernancePipelineResult {
  const { message, userId, flags } = input;

  // ─── Step 1: Governance Gate (V12.4) ───
  const gateInput: VoiceGovernanceGateInput = {
    message,
    bridgeEnabled: flags.bridgeEnabled,
    allowVaultInjection: flags.allowVaultInjection,
    userId,
  };
  const gate = evaluateGovernanceGate(gateInput);

  // ─── Step 2: Routing Decision (V12.6) ───
  const teleGPTHealthy =
    input.teleGPTHealthyOverride ?? getCachedHealth();

  const routingInput: VoiceRoutingInput = {
    gate,
    flags,
    teleGPTHealthy,
  };
  const routing = makeRoutingDecision(routingInput);

  // ─── Step 3: Secret Injection Check (V12.7) ───
  const shouldInjectSecrets =
    flags.allowVaultInjection &&
    gate.allowed &&
    message.includes("${vault:");

  // ─── Step 4: Record Trace (V12.8) ───
  const traceInput: VoiceCreateTraceInput = {
    userId,
    message,
    routedTo: routing.route === "telegpt" ? "telegpt" : "local",
    resultStatus:
      routing.route === "blocked"
        ? "blocked"
        : "success",
    gateId: gate.gateId,
    messageType: gate.messageType,
    routingReason: routing.reason,
  };
  const trace = createTrace(traceInput);
  recordTrace(trace);

  return {
    gate,
    routing,
    shouldInjectSecrets,
    traceId: trace.traceId,
  };
}

// ============================================================================
// Health check wrapper with trace
// ============================================================================

export async function checkTeleGPTHealthWithTrace(
  healthCheck: () => Promise<boolean>,
): Promise<boolean> {
  const startMs = Date.now();
  let healthy = false;

  try {
    healthy = await healthCheck();
  } catch {
    healthy = false;
  }

  updateCachedHealth(healthy);

  recordTrace({
    traceId: `trace_health_${Date.now()}`,
    userId: "system",
    message: "health_check",
    routedTo: "local",
    resultStatus: healthy ? "success" : "error",
    latencyMs: Date.now() - startMs,
    messageType: "health_query",
    timestamp: Date.now(),
  });

  return healthy;
}

// ============================================================================
// Secret injection with guard + trace
// ============================================================================

export interface VoiceInjectSecretsResult {
  message: string;
  injected: string[];
  blocked: string[];
  guards: ReturnType<typeof evaluateSecretInjectionGuard>[];
}

export async function injectSecretsWithGuard(
  message: string,
  userId: string,
  resolver: {
    resolve: (alias: string, userId?: string) => Promise<{
      found: boolean;
      value?: string;
      error?: string;
    }>;
  },
  flags: VoiceFeatureFlags,
): Promise<VoiceInjectSecretsResult> {
  const vaultPattern = /\$\{vault:([^}]+)\}/g;
  const matches = [...message.matchAll(vaultPattern)];

  if (matches.length === 0 || !flags.allowVaultInjection) {
    return { message, injected: [], blocked: [], guards: [] };
  }

  const guards: ReturnType<typeof evaluateSecretInjectionGuard>[] = [];
  const injected: string[] = [];
  const blocked: string[] = [];
  let result = message;

  for (const match of matches) {
    const fullMatch = match[0];
    const alias = match[1];

    // Evaluate guard
    const guardInput: VoiceInjectionGuardInput = {
      alias,
      userId,
      allowInjection: flags.allowVaultInjection,
    };
    const guard = evaluateSecretInjectionGuard(guardInput);
    guards.push(guard);

    if (!guard.allowed) {
      blocked.push(alias);
      continue;
    }

    // Resolve secret
    const secretResult = await resolver.resolve(alias, userId);

    if (secretResult.found && secretResult.value) {
      // Apply masking
      const maskedValue = guard.maskPattern
        ? maskSecretValue(secretResult.value, guard.maskPattern)
        : secretResult.value;

      result = result.replace(fullMatch, maskedValue);
      injected.push(alias);
    } else {
      blocked.push(`${alias}: ${secretResult.error ?? "not found"}`);
    }
  }

  // Record trace
  recordTrace({
    traceId: `trace_inject_${Date.now()}`,
    userId,
    message: `inject_secrets: ${injected.length} injected, ${blocked.length} blocked`,
    routedTo: "vault",
    resultStatus: blocked.length > 0 ? "fallback" : "success",
    messageType: "sensitive_request",
    timestamp: Date.now(),
  });

  return { message: result, injected, blocked, guards };
}

// ============================================================================
// Summary
// ============================================================================

export function buildRuntimeGovernanceSummary() {
  const traceStats = getTraceStatistics();

  return {
    traceStatistics: traceStats,
    successRate:
      traceStats.totalTraces > 0
        ? Math.round((traceStats.successCount / traceStats.totalTraces) * 100)
        : 0,
    fallbackRate:
      traceStats.totalTraces > 0
        ? Math.round((traceStats.fallbackCount / traceStats.totalTraces) * 100)
        : 0,
    errorRate:
      traceStats.totalTraces > 0
        ? Math.round((traceStats.errorCount / traceStats.totalTraces) * 100)
        : 0,
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatRuntimeGovernanceSummary(): string {
  const summary = buildRuntimeGovernanceSummary();

  return [
    `🏛️ Runtime Governance Summary`,
    ``,
    `Traces:`,
    `  • total: ${summary.traceStatistics.totalTraces}`,
    `  • ✅ success: ${summary.traceStatistics.successCount} (${summary.successRate}%)`,
    `  • ⚠️ fallback: ${summary.traceStatistics.fallbackCount} (${summary.fallbackRate}%)`,
    `  • ❌ error: ${summary.traceStatistics.errorCount} (${summary.errorRate}%)`,
    `  • avg latency: ${summary.traceStatistics.avgLatencyMs}ms`,
    ``,
    `Routes:`,
    `  • 🧠 Tele GPT: ${summary.traceStatistics.teleGPTRouteCount}`,
    `  • 🔐 Vault: ${summary.traceStatistics.vaultRouteCount}`,
    `  • 🏠 Local: ${summary.traceStatistics.localRouteCount}`,
  ].join("\n");
}
