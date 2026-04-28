// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Dormant Memory
//
// Some remembered things must stay dormant unless clearly useful.
// Memory exists but doesn't surface until there's clear benefit.
// "Помню, но не лезу слишком глубоко" — remember, but don't intrude.
// ─────────────────────────────────────────────────────────────

import type { ArishaMemoryContext } from "./types.js";

export type DormantMemoryBehavior = {
  shouldSurface: boolean;
  behavior: "stay_dormant" | "surface_subtly" | "use_internally_only";
  reason: string;
};

export function resolveDormantMemoryBehavior(input: {
  memoryContext: ArishaMemoryContext;
  currentContextRelevance: "low" | "medium" | "high";
}): DormantMemoryBehavior {
  const ctx = input.memoryContext;
  const relevance = input.currentContextRelevance;

  // Very long dormant (>20 turns) → stay dormant unless high relevance
  if (ctx.lastActiveTurnsAgo > 20) {
    if (relevance === "high") {
      return {
        shouldSurface: true,
        behavior: "surface_subtly",
        reason: "Long dormant but highly relevant — surface subtly",
      };
    }
    return {
      shouldSurface: false,
      behavior: "stay_dormant",
      reason: "Long dormant and not highly relevant — stay dormant",
    };
  }

  // Moderately dormant (10-20 turns) → use internally only
  if (ctx.lastActiveTurnsAgo > 10) {
    return {
      shouldSurface: false,
      behavior: "use_internally_only",
      reason: "Moderately dormant — use internally for consistency, don't surface",
    };
  }

  // Recent memory → can surface if relevant
  if (relevance === "high") {
    return {
      shouldSurface: true,
      behavior: "surface_subtly",
      reason: "Recent and highly relevant — surface subtly",
    };
  }

  if (relevance === "medium") {
    return {
      shouldSurface: false,
      behavior: "use_internally_only",
      reason: "Recent and moderately relevant — use internally",
    };
  }

  // Low relevance → stay dormant
  return {
    shouldSurface: false,
    behavior: "stay_dormant",
    reason: "Low relevance — stay dormant",
  };
}

export function getDormantBehaviorDescription(behavior: DormantMemoryBehavior["behavior"]): string {
  switch (behavior) {
    case "stay_dormant":
      return "Stay dormant — memory exists but should not influence response";
    case "surface_subtly":
      return "Surface subtly — memory may gently influence response without explicit reference";
    case "use_internally_only":
      return "Use internally only — memory informs response internally, never surface explicitly";
    default:
      return `Unknown dormant behavior: ${behavior}`;
  }
}
