/**
 * Voice Safe Routing & Failover Layer — V12.6
 *
 * First-class entity: VoiceRoutingDecision
 *
 * This layer answers:
 *   - "Where should this message be routed?"
 *   - "Is Tele GPT healthy enough to handle this?"
 *   - "What fallback should we use if Tele GPT is down?"
 *
 * RULE: NO USER REQUEST MAY FAIL HARD WITHOUT CONTROLLED FALLBACK
 */

import type {
  VoiceRuntimeGovernanceGate,
  VoiceMessageType,
} from "./voiceRuntimeGovernanceGate.js";
import type { VoiceFeatureFlags } from "./voiceFeatureFlagGovernance.js";

export type VoiceRoutingDecision =
  | "telegpt"
  | "local_fallback"
  | "blocked";

export type VoiceRoutingReason =
  | "teleGPT_healthy"
  | "teleGPT_degraded"
  | "teleGPT_down_failopen"
  | "teleGPT_down_blocked"
  | "gate_blocked"
  | "vault_command_local"
  | "health_query_local";

export interface VoiceRoutingResult {
  route: VoiceRoutingDecision;
  reason: VoiceRoutingReason;
  gateResult: VoiceRuntimeGovernanceGate;
  teleGPTHealthy: boolean;
}

export interface VoiceRoutingInput {
  gate: VoiceRuntimeGovernanceGate;
  flags: VoiceFeatureFlags;
  teleGPTHealthy: boolean;
}

// ============================================================================
// Routing decision
// ============================================================================

/**
 * Make routing decision based on governance gate, feature flags, and Tele GPT health.
 * Pure function — determines where message should go.
 */
export function makeRoutingDecision(
  input: VoiceRoutingInput,
): VoiceRoutingResult {
  const { gate, flags, teleGPTHealthy } = input;

  // Gate blocked → blocked
  if (!gate.allowed) {
    return {
      route: "blocked",
      reason: "gate_blocked",
      gateResult: gate,
      teleGPTHealthy,
    };
  }

  switch (gate.messageType) {
    case "vault_command":
      return {
        route: "local_fallback",
        reason: "vault_command_local",
        gateResult: gate,
        teleGPTHealthy,
      };

    case "health_query":
      return {
        route: "local_fallback",
        reason: "health_query_local",
        gateResult: gate,
        teleGPTHealthy,
      };

    case "sensitive_request":
    case "ai_request":
    case "unknown":
      if (teleGPTHealthy) {
        return {
          route: "telegpt",
          reason: "teleGPT_healthy",
          gateResult: gate,
          teleGPTHealthy,
        };
      }

      // Tele GPT is down — check fail-open
      if (flags.failOpenLocal) {
        return {
          route: "local_fallback",
          reason: "teleGPT_down_failopen",
          gateResult: gate,
          teleGPTHealthy,
        };
      }

      // No fail-open → blocked
      return {
        route: "blocked",
        reason: "teleGPT_down_blocked",
        gateResult: gate,
        teleGPTHealthy,
      };

    default:
      return {
        route: "blocked",
        reason: "gate_blocked",
        gateResult: gate,
        teleGPTHealthy,
      };
  }
}

// ============================================================================
// Health check cache
// ============================================================================

export interface VoiceHealthCheckCache {
  healthy: boolean;
  lastCheckMs: number;
  cacheTTL: number;
}

const _healthCache: VoiceHealthCheckCache = {
  healthy: true,
  lastCheckMs: 0,
  cacheTTL: 30_000,
};

export function getCachedHealth(): boolean {
  const now = Date.now();
  if (now - _healthCache.lastCheckMs > _healthCache.cacheTTL) {
    return _healthCache.healthy; // stale, but return last known
  }
  return _healthCache.healthy;
}

export function updateCachedHealth(healthy: boolean): void {
  _healthCache.healthy = healthy;
  _healthCache.lastCheckMs = Date.now();
}

export function setHealthCacheForTest(healthy: boolean, ageMs = 0): void {
  _healthCache.healthy = healthy;
  _healthCache.lastCheckMs = Date.now() - ageMs;
}

export function resetHealthCache(): void {
  _healthCache.healthy = true;
  _healthCache.lastCheckMs = 0;
}

// ============================================================================
// Fallback responses
// ============================================================================

export function getFallbackMessage(
  reason: VoiceRoutingReason,
  flags: VoiceFeatureFlags,
): string {
  switch (reason) {
    case "teleGPT_down_failopen":
      return (
        "⚠️ Tele GPT is temporarily unavailable. " +
        "Vault commands (/get, /status, /audit) still work."
      );

    case "teleGPT_down_blocked":
      return (
        "🚫 Tele GPT is unavailable and fail-open is disabled. " +
        "Please try again later."
      );

    case "gate_blocked":
      return "🚫 Request blocked by governance gate.";

    case "vault_command_local":
    case "health_query_local":
      return ""; // Should not reach fallback

    default:
      return "⚠️ Unable to process request.";
  }
}

// ============================================================================
// Formatter
// ============================================================================

export function formatRoutingResult(result: VoiceRoutingResult): string {
  const routeEmoji: Record<VoiceRoutingDecision, string> = {
    telegpt: "🧠",
    local_fallback: "🏠",
    blocked: "🚫",
  };

  return [
    `🔀 Routing Decision`,
    `• route: ${routeEmoji[result.route]} ${result.route}`,
    `• reason: ${result.reason}`,
    `• gate type: ${result.gateResult.messageType}`,
    `• gate allowed: ${result.gateResult.allowed ? "✅" : "❌"}`,
    `• Tele GPT healthy: ${result.teleGPTHealthy ? "✅" : "❌"}`,
  ].join("\n");
}
