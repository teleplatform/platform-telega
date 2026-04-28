// ─────────────────────────────────────────────────────────────
// ALICE LIVE OPERATIONS / POST-LAUNCH CONTROL PACK v1.0 — Health
//
// Bounded post-launch health layer:
// - ingress alive
// - protocol alive
// - bridge alive
// - safe fallback available
//
// Health states: healthy, degraded, unknown
// Safe fallback ≠ healthy.
// ─────────────────────────────────────────────────────────────

import type { AliceLiveHealthSnapshot } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildAliceLiveHealthSnapshot(input: {
  ingressAlive?: boolean;
  protocolAlive?: boolean;
  bridgeAlive?: boolean;
  safeFallbackAvailable?: boolean;
  warnings?: string[];
  notes?: string[];
}): AliceLiveHealthSnapshot {
  const ingressAlive = input.ingressAlive ?? true;
  const protocolAlive = input.protocolAlive ?? true;
  const bridgeAlive = input.bridgeAlive ?? true;
  const safeFallbackAvailable = input.safeFallbackAvailable ?? true;

  // Determine health
  const criticalChecks = [ingressAlive, protocolAlive, bridgeAlive];
  const criticalFailures = criticalChecks.filter((c) => !c).length;

  let health: "healthy" | "degraded" | "unknown" = "healthy";

  if (criticalFailures === 0 && safeFallbackAvailable) {
    health = "healthy";
  } else if (criticalFailures > 0) {
    // Any critical check failed → unknown (can't determine full health)
    health = "unknown";
  } else if (!safeFallbackAvailable) {
    // All critical checks pass but no fallback → degraded
    health = "degraded";
  }

  const warnings: string[] = [...(input.warnings ?? [])];
  if (!safeFallbackAvailable) {
    warnings.push("Safe fallback not available — degraded resilience");
  }
  if (criticalFailures > 0) {
    warnings.push(`${criticalFailures} critical check(s) failing`);
  }

  return {
    health,
    checks: {
      ingressAlive,
      protocolAlive,
      bridgeAlive,
      safeFallbackAvailable,
    },
    warnings: warnings.length > 0 ? warnings : undefined,
    notes: input.notes,
  };
}

export function getHealthDescription(health: AliceLiveHealthSnapshot["health"]): string {
  switch (health) {
    case "healthy":
      return "All critical checks passing — safe fallback available";
    case "degraded":
      return "Critical checks passing but safe fallback unavailable — reduced resilience";
    case "unknown":
      return "One or more critical checks failing — health indeterminate";
    default:
      return `Unknown health: ${health}`;
  }
}
