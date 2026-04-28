// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Tone Adaptation
//
// Bounded tone adaptation.
// System can soften, tighten, simplify, warm up, or stay consistent.
// Must not over-adapt or sound unnatural.
// ─────────────────────────────────────────────────────────────

import type { ArishaToneAdaptationDecision, ArishaMemoryContext } from "./types.js";

export function buildArishaToneAdaptationDecision(input: {
  memoryContext: ArishaMemoryContext;
  userEmotionalTone?: "neutral" | "stressed" | "casual" | "formal" | "distressed";
  currentBoundaryMode: "none" | "minimal" | "contextual" | "continuity_only";
}): ArishaToneAdaptationDecision {
  const ctx = input.memoryContext;
  const userTone = input.userEmotionalTone ?? "neutral";
  const boundaryMode = input.currentBoundaryMode;

  // No memory use → no adaptation
  if (boundaryMode === "none") {
    return {
      shouldAdapt: false,
      adaptationType: "none",
      reason: "Memory boundary does not allow adaptation",
    };
  }

  // User distressed → soften, don't personalize heavily
  if (userTone === "distressed" || userTone === "stressed") {
    return {
      shouldAdapt: true,
      adaptationType: "soften",
      reason: "User appears stressed — softening tone for comfort",
      notes: ["Prioritize comfort over personalization"],
    };
  }

  // User casual → warm up slightly (if boundary allows)
  if (userTone === "casual" && boundaryMode === "contextual") {
    return {
      shouldAdapt: true,
      adaptationType: "warm_up",
      reason: "User tone is casual — warming response slightly",
      notes: ["Match user's casual tone naturally"],
    };
  }

  // User formal → tighten, stay professional
  if (userTone === "formal") {
    return {
      shouldAdapt: true,
      adaptationType: "tighten",
      reason: "User tone is formal — tightening response",
      notes: ["Match user's formal tone"],
    };
  }

  // Early conversation → stay consistent, don't over-adapt
  if (ctx.conversationTurns <= 3) {
    return {
      shouldAdapt: false,
      adaptationType: "stay_consistent",
      reason: "Early conversation — maintaining consistent tone",
      notes: ["Avoid adaptation until user pattern is clear"],
    };
  }

  // Default → no adaptation needed
  return {
    shouldAdapt: false,
    adaptationType: "stay_consistent",
    reason: "No adaptation needed — maintaining current tone",
  };
}

export function getAdaptationTypeDescription(type: ArishaToneAdaptationDecision["adaptationType"]): string {
  switch (type) {
    case "none":
      return "No adaptation — tone remains unchanged";
    case "soften":
      return "Soften tone — more gentle, supportive, less direct";
    case "tighten":
      return "Tighten tone — more structured, professional, concise";
    case "simplify":
      return "Simplify tone — clearer, less complex language";
    case "warm_up":
      return "Warm up tone — slightly more friendly and natural";
    case "stay_consistent":
      return "Stay consistent — maintain current tone pattern";
    default:
      return `Unknown adaptation type: ${type}`;
  }
}
