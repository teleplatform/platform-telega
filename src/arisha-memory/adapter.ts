// ─────────────────────────────────────────────────────────────
// ARISHA MEMORY / PERSONALIZATION TRUST LAYER v1.0 — Main Handler
//
// prepareArishaMemoryPersonalizationDecision() does ONLY:
// 1. resolve memory boundary
// 2. resolve memory usage
// 3. resolve continuity
// 4. resolve personalization profile
// 5. resolve tone adaptation
// 6. apply dormant memory logic
// 7. enforce trust-preserving behavior
// 8. enforce safety precedence
// 9. never activate remembered context just because it exists
// ─────────────────────────────────────────────────────────────

import type {
  ArishaMemoryPersonalizationDecision,
  ArishaMemoryBoundaryDecision,
  ArishaMemoryUsageDecision,
  ArishaContinuityDecision,
  ArishaPersonalizationProfile,
  ArishaToneAdaptationDecision,
  ArishaMemoryContext,
} from "./types.js";
import { buildArishaMemoryBoundaryDecision } from "./memory-boundary.js";
import { buildArishaMemoryUsageDecision } from "./memory-usage.js";
import { buildArishaContinuityDecision } from "./continuity.js";
import { buildArishaPersonalizationProfile } from "./personalization.js";
import { buildArishaToneAdaptationDecision } from "./tone.js";
import { resolveDormantMemoryBehavior } from "./dormancy.js";
import { preserveArishaMemoryTrustBehavior } from "./trust.js";
import { enforceMemoryTrustSafetyBoundary } from "./safety.js";

export function prepareArishaMemoryPersonalizationDecision(input: {
  memoryContext: ArishaMemoryContext;
  userEmotionalTone?: "neutral" | "stressed" | "casual" | "formal" | "distressed";
  currentTopicSensitive?: boolean;
  topicChanged?: boolean;
  userRequestedPersonalization?: boolean;
  safetyEscalationActive?: boolean;
  trustBoundaryActive?: boolean;
  refusalActive?: boolean;
  currentContextRelevance?: "low" | "medium" | "high";
}): ArishaMemoryPersonalizationDecision {
  const ctx = input.memoryContext;

  // 1. Resolve memory boundary
  const boundary: ArishaMemoryBoundaryDecision = buildArishaMemoryBoundaryDecision({
    memoryContext: ctx,
    currentTopicSensitive: input.currentTopicSensitive,
  });

  // 2. Resolve memory usage
  const usage: ArishaMemoryUsageDecision = buildArishaMemoryUsageDecision({
    boundary,
    memoryContext: ctx,
    userRequestedPersonalization: input.userRequestedPersonalization,
  });

  // 3. Resolve continuity
  const continuity: ArishaContinuityDecision = buildArishaContinuityDecision({
    boundary,
    memoryContext: ctx,
    topicChanged: input.topicChanged,
  });

  // 4. Resolve personalization profile (default if none provided)
  const profile: ArishaPersonalizationProfile = buildArishaPersonalizationProfile();

  // 5. Resolve tone adaptation
  const toneAdaptation: ArishaToneAdaptationDecision = buildArishaToneAdaptationDecision({
    memoryContext: ctx,
    userEmotionalTone: input.userEmotionalTone,
    currentBoundaryMode: boundary.mode,
  });

  // 6. Apply dormant memory logic
  const dormantBehavior = resolveDormantMemoryBehavior({
    memoryContext: ctx,
    currentContextRelevance: input.currentContextRelevance ?? "medium",
  });
  const dormantMemoryHandled = !dormantBehavior.shouldSurface || dormantBehavior.behavior !== "stay_dormant";

  // 7. Enforce trust-preserving behavior
  const trustCheck = preserveArishaMemoryTrustBehavior({
    boundary,
    usage,
    continuity,
    toneAdaptation,
  });
  const trustPreserved = trustCheck.trustPreserved;

  // 8. Enforce safety precedence
  const safetyCheck = enforceMemoryTrustSafetyBoundary({
    memoryContext: ctx,
    safetyEscalationActive: input.safetyEscalationActive,
    trustBoundaryActive: input.trustBoundaryActive,
    refusalActive: input.refusalActive,
  });
  const safetyPrecedentEnforced = !safetyCheck.personalizationAllowed;

  // 9. Return — never activate remembered context just because it exists
  return {
    boundary,
    usage,
    continuity,
    profile,
    toneAdaptation,
    dormantMemoryHandled,
    trustPreserved,
    safetyPrecedentEnforced,
  };
}
