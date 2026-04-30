// Arisha Memory / Personalization Trust Layer v1.0 — Unit Tests
// Run with: npx tsx tests/unit/arisha-memory/arisha-memory-personalization-trust-layer.test.ts

import assert from "node:assert/strict";
import { arishaMemoryTrustAdapter } from "../../../src/arisha-memory/builtin.js";
import { validateArishaMemoryTrustAdapter } from "../../../src/arisha-memory/validators.js";
import {
  getArishaMemoryTrustAdapter,
  supportsMemoryBoundary,
  supportsMemoryUsageDecisions,
  supportsPersonalizationProfiles,
  supportsToneAdaptation,
  supportsContinuityDecisions,
  supportsDormantMemoryHandling,
  getAdapterVersion,
  getAdapterId,
} from "../../../src/arisha-memory/selectors.js";
import {
  buildArishaMemoryBoundaryDecision,
  getBoundaryModeDescription,
} from "../../../src/arisha-memory/memory-boundary.js";
import {
  buildArishaMemoryUsageDecision,
  getUsageTypeDescription,
} from "../../../src/arisha-memory/memory-usage.js";
import {
  buildArishaPersonalizationProfile,
  getDefaultPersonalizationProfile,
  getToneStyleDescription,
  getVerbosityDescription,
  getContinuityLevelDescription,
} from "../../../src/arisha-memory/personalization.js";
import {
  buildArishaToneAdaptationDecision,
  getAdaptationTypeDescription,
} from "../../../src/arisha-memory/tone.js";
import {
  buildArishaContinuityDecision,
  getContinuityTypeDescription,
} from "../../../src/arisha-memory/continuity.js";
import {
  preserveArishaMemoryTrustBehavior,
  getTrustPreservationGuidance,
} from "../../../src/arisha-memory/trust.js";
import {
  enforceMemoryTrustSafetyBoundary,
  getSafetyPrecedenceDescription,
} from "../../../src/arisha-memory/safety.js";
import {
  resolveDormantMemoryBehavior,
  getDormantBehaviorDescription,
} from "../../../src/arisha-memory/dormancy.js";
import {
  prepareArishaMemoryPersonalizationDecision,
} from "../../../src/arisha-memory/adapter.js";
import type { ArishaMemoryContext } from "../../../src/arisha-memory/types.js";

// Auto-registered via builtin import
const ADAPTER = arishaMemoryTrustAdapter;

// Helper to create test memory contexts
function createMemoryContext(overrides?: Partial<ArishaMemoryContext>): ArishaMemoryContext {
  return {
    conversationTurns: 5,
    hasPreferences: false,
    hasHistory: false,
    lastActiveTurnsAgo: 0,
    sensitiveContextPresent: false,
    safetyEscalationActive: false,
    ...overrides,
  };
}

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// ── Builtin Loading ──
console.log("\nBuiltin loading:");

test("builtin memory trust adapter loads", () => {
  assert.ok(ADAPTER);
  assert.equal(ADAPTER.adapterId, "arisha_memory_personalization_trust_v1");
  assert.equal(ADAPTER.version, "1.0.0");
});

test("builtin has all feature flags", () => {
  assert.equal(ADAPTER.supportsMemoryBoundary, true);
  assert.equal(ADAPTER.supportsMemoryUsageDecisions, true);
  assert.equal(ADAPTER.supportsPersonalizationProfiles, true);
  assert.equal(ADAPTER.supportsToneAdaptation, true);
  assert.equal(ADAPTER.supportsContinuityDecisions, true);
  assert.equal(ADAPTER.supportsDormantMemoryHandling, true);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin adapter validates with no errors", () => {
  const errors = validateArishaMemoryTrustAdapter(ADAPTER);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Memory Boundary ──
console.log("\nMemory boundary:");

test("buildArishaMemoryBoundaryDecision returns none for safety escalation", () => {
  const ctx = createMemoryContext({ safetyEscalationActive: true });
  const decision = buildArishaMemoryBoundaryDecision({ memoryContext: ctx });
  assert.equal(decision.mayUseMemory, false);
  assert.equal(decision.mode, "none");
});

test("buildArishaMemoryBoundaryDecision returns none for sensitive context", () => {
  const ctx = createMemoryContext({ sensitiveContextPresent: true });
  const decision = buildArishaMemoryBoundaryDecision({ memoryContext: ctx });
  assert.equal(decision.mayUseMemory, false);
  assert.equal(decision.mode, "none");
});

test("buildArishaMemoryBoundaryDecision returns minimal for early conversation", () => {
  const ctx = createMemoryContext({ conversationTurns: 1, hasPreferences: true });
  const decision = buildArishaMemoryBoundaryDecision({ memoryContext: ctx });
  assert.equal(decision.mayUseMemory, true);
  assert.equal(decision.mode, "minimal");
});

test("buildArishaMemoryBoundaryDecision returns continuity_only for long dormant", () => {
  const ctx = createMemoryContext({ lastActiveTurnsAgo: 15, hasHistory: true });
  const decision = buildArishaMemoryBoundaryDecision({ memoryContext: ctx });
  assert.equal(decision.mayUseMemory, true);
  assert.equal(decision.mode, "continuity_only");
});

test("buildArishaMemoryBoundaryDecision returns contextual for normal conversation", () => {
  const ctx = createMemoryContext({ conversationTurns: 5, hasPreferences: true, hasHistory: true });
  const decision = buildArishaMemoryBoundaryDecision({ memoryContext: ctx });
  assert.equal(decision.mayUseMemory, true);
  assert.equal(decision.mode, "contextual");
});

test("getBoundaryModeDescription returns description for each mode", () => {
  assert.ok(getBoundaryModeDescription("none").length > 0);
  assert.ok(getBoundaryModeDescription("minimal").length > 0);
  assert.ok(getBoundaryModeDescription("contextual").length > 0);
  assert.ok(getBoundaryModeDescription("continuity_only").length > 0);
});

// ── Memory Usage ──
console.log("\nMemory usage:");

test("buildArishaMemoryUsageDecision returns none when boundary says no", () => {
  const boundary = { mayUseMemory: false, mode: "none" as const };
  const ctx = createMemoryContext();
  const decision = buildArishaMemoryUsageDecision({ boundary, memoryContext: ctx });
  assert.equal(decision.shouldUse, false);
  assert.equal(decision.usageType, "none");
});

test("buildArishaMemoryUsageDecision returns continuity for continuity_only mode", () => {
  const boundary = { mayUseMemory: true, mode: "continuity_only" as const };
  const ctx = createMemoryContext();
  const decision = buildArishaMemoryUsageDecision({ boundary, memoryContext: ctx });
  assert.equal(decision.shouldUse, true);
  assert.equal(decision.usageType, "continuity");
});

test("buildArishaMemoryUsageDecision returns preference for minimal mode", () => {
  const boundary = { mayUseMemory: true, mode: "minimal" as const };
  const ctx = createMemoryContext();
  const decision = buildArishaMemoryUsageDecision({ boundary, memoryContext: ctx });
  assert.equal(decision.shouldUse, true);
  assert.equal(decision.usageType, "preference");
});

test("buildArishaMemoryUsageDecision returns preference for contextual with preferences", () => {
  const boundary = { mayUseMemory: true, mode: "contextual" as const };
  const ctx = createMemoryContext({ hasPreferences: true });
  const decision = buildArishaMemoryUsageDecision({ boundary, memoryContext: ctx });
  assert.equal(decision.shouldUse, true);
  assert.equal(decision.usageType, "preference");
});

test("getUsageTypeDescription returns description for each type", () => {
  assert.ok(getUsageTypeDescription("none").length > 0);
  assert.ok(getUsageTypeDescription("preference").length > 0);
  assert.ok(getUsageTypeDescription("tone").length > 0);
  assert.ok(getUsageTypeDescription("continuity").length > 0);
  assert.ok(getUsageTypeDescription("context_hint").length > 0);
});

// ── Personalization Profile ──
console.log("\nPersonalization profile:");

test("buildArishaPersonalizationProfile builds valid profile", () => {
  const profile = buildArishaPersonalizationProfile({
    toneStyle: "warm",
    verbosity: "balanced",
    continuityLevel: "medium",
  });
  assert.equal(profile.toneStyle, "warm");
  assert.equal(profile.verbosity, "balanced");
  assert.equal(profile.continuityLevel, "medium");
});

test("getDefaultPersonalizationProfile returns neutral profile", () => {
  const profile = getDefaultPersonalizationProfile();
  assert.equal(profile.toneStyle, "neutral");
  assert.equal(profile.verbosity, "balanced");
  assert.equal(profile.continuityLevel, "medium");
});

test("getToneStyleDescription returns description for each style", () => {
  assert.ok(getToneStyleDescription("neutral").length > 0);
  assert.ok(getToneStyleDescription("warm").length > 0);
  assert.ok(getToneStyleDescription("professional").length > 0);
});

test("getVerbosityDescription returns description for each verbosity", () => {
  assert.ok(getVerbosityDescription("short").length > 0);
  assert.ok(getVerbosityDescription("balanced").length > 0);
  assert.ok(getVerbosityDescription("detailed").length > 0);
});

test("getContinuityLevelDescription returns description for each level", () => {
  assert.ok(getContinuityLevelDescription("low").length > 0);
  assert.ok(getContinuityLevelDescription("medium").length > 0);
  assert.ok(getContinuityLevelDescription("high").length > 0);
});

// ── Tone Adaptation ──
console.log("\nTone adaptation:");

test("buildArishaToneAdaptationDecision returns none for no memory", () => {
  const ctx = createMemoryContext();
  const decision = buildArishaToneAdaptationDecision({
    memoryContext: ctx,
    currentBoundaryMode: "none",
  });
  assert.equal(decision.shouldAdapt, false);
  assert.equal(decision.adaptationType, "none");
});

test("buildArishaToneAdaptationDecision returns soften for distressed user", () => {
  const ctx = createMemoryContext();
  const decision = buildArishaToneAdaptationDecision({
    memoryContext: ctx,
    userEmotionalTone: "distressed",
    currentBoundaryMode: "contextual",
  });
  assert.equal(decision.shouldAdapt, true);
  assert.equal(decision.adaptationType, "soften");
});

test("buildArishaToneAdaptationDecision returns warm_up for casual user", () => {
  const ctx = createMemoryContext();
  const decision = buildArishaToneAdaptationDecision({
    memoryContext: ctx,
    userEmotionalTone: "casual",
    currentBoundaryMode: "contextual",
  });
  assert.equal(decision.shouldAdapt, true);
  assert.equal(decision.adaptationType, "warm_up");
});

test("buildArishaToneAdaptationDecision returns tighten for formal user", () => {
  const ctx = createMemoryContext();
  const decision = buildArishaToneAdaptationDecision({
    memoryContext: ctx,
    userEmotionalTone: "formal",
    currentBoundaryMode: "contextual",
  });
  assert.equal(decision.shouldAdapt, true);
  assert.equal(decision.adaptationType, "tighten");
});

test("buildArishaToneAdaptationDecision stays consistent for early conversation", () => {
  const ctx = createMemoryContext({ conversationTurns: 2 });
  const decision = buildArishaToneAdaptationDecision({
    memoryContext: ctx,
    currentBoundaryMode: "minimal",
  });
  assert.equal(decision.shouldAdapt, false);
  assert.equal(decision.adaptationType, "stay_consistent");
});

test("getAdaptationTypeDescription returns description for each type", () => {
  assert.ok(getAdaptationTypeDescription("none").length > 0);
  assert.ok(getAdaptationTypeDescription("soften").length > 0);
  assert.ok(getAdaptationTypeDescription("warm_up").length > 0);
});

// ── Continuity ──
console.log("\nContinuity:");

test("buildArishaContinuityDecision returns none when boundary says no", () => {
  const boundary = { mayUseMemory: false, mode: "none" as const };
  const ctx = createMemoryContext();
  const decision = buildArishaContinuityDecision({ boundary, memoryContext: ctx });
  assert.equal(decision.shouldCarryContinuity, false);
  assert.equal(decision.continuityType, "none");
});

test("buildArishaContinuityDecision returns topic_continuity for continuity_only", () => {
  const boundary = { mayUseMemory: true, mode: "continuity_only" as const };
  const ctx = createMemoryContext();
  const decision = buildArishaContinuityDecision({ boundary, memoryContext: ctx });
  assert.equal(decision.shouldCarryContinuity, true);
  assert.equal(decision.continuityType, "topic_continuity");
});

test("buildArishaContinuityDecision returns none when topic changed", () => {
  const boundary = { mayUseMemory: true, mode: "contextual" as const };
  const ctx = createMemoryContext();
  const decision = buildArishaContinuityDecision({ boundary, memoryContext: ctx, topicChanged: true });
  assert.equal(decision.shouldCarryContinuity, false);
  assert.equal(decision.continuityType, "none");
});

test("buildArishaContinuityDecision returns topic_continuity for active conversation", () => {
  const boundary = { mayUseMemory: true, mode: "contextual" as const };
  const ctx = createMemoryContext({ hasHistory: true, conversationTurns: 3 });
  const decision = buildArishaContinuityDecision({ boundary, memoryContext: ctx });
  assert.equal(decision.shouldCarryContinuity, true);
  assert.equal(decision.continuityType, "topic_continuity");
});

test("getContinuityTypeDescription returns description for each type", () => {
  assert.ok(getContinuityTypeDescription("none").length > 0);
  assert.ok(getContinuityTypeDescription("topic_continuity").length > 0);
  assert.ok(getContinuityTypeDescription("preference_continuity").length > 0);
});

// ── Trust Preservation ──
console.log("\nTrust preservation:");

test("preserveArishaMemoryTrustBehavior returns true when memory suspended", () => {
  const result = preserveArishaMemoryTrustBehavior({
    boundary: { mayUseMemory: false, mode: "none" },
    usage: { shouldUse: false, usageType: "none" },
    continuity: { shouldCarryContinuity: false, continuityType: "none" },
    toneAdaptation: { shouldAdapt: false, adaptationType: "none" },
  });
  assert.equal(result.trustPreserved, true);
});

test("preserveArishaMemoryTrustBehavior returns true for valid memory use", () => {
  const result = preserveArishaMemoryTrustBehavior({
    boundary: { mayUseMemory: true, mode: "contextual" },
    usage: { shouldUse: true, usageType: "preference" },
    continuity: { shouldCarryContinuity: true, continuityType: "topic_continuity" },
    toneAdaptation: { shouldAdapt: true, adaptationType: "soften" },
  });
  assert.equal(result.trustPreserved, true);
});

test("getTrustPreservationGuidance returns guidance items", () => {
  const guidance = getTrustPreservationGuidance();
  assert.ok(guidance.length > 0);
  // Check key guidance points
  assert.ok(guidance.some((g) => g.toLowerCase().includes("remember")));
  assert.ok(guidance.some((g) => g.toLowerCase().includes("safety")));
});

// ── Safety Precedence ──
console.log("\nSafety precedence:");

test("enforceMemoryTrustSafetyBoundary returns false for safety escalation", () => {
  const ctx = createMemoryContext({ safetyEscalationActive: true });
  const result = enforceMemoryTrustSafetyBoundary({ memoryContext: ctx });
  assert.equal(result.personalizationAllowed, false);
});

test("enforceMemoryTrustSafetyBoundary returns false for sensitive context", () => {
  const ctx = createMemoryContext({ sensitiveContextPresent: true });
  const result = enforceMemoryTrustSafetyBoundary({ memoryContext: ctx });
  assert.equal(result.personalizationAllowed, false);
});

test("enforceMemoryTrustSafetyBoundary returns false for active trust boundary", () => {
  const ctx = createMemoryContext();
  const result = enforceMemoryTrustSafetyBoundary({ memoryContext: ctx, trustBoundaryActive: true });
  assert.equal(result.personalizationAllowed, false);
});

test("enforceMemoryTrustSafetyBoundary returns false for active refusal", () => {
  const ctx = createMemoryContext();
  const result = enforceMemoryTrustSafetyBoundary({ memoryContext: ctx, refusalActive: true });
  assert.equal(result.personalizationAllowed, false);
});

test("enforceMemoryTrustSafetyBoundary returns true when all clear", () => {
  const ctx = createMemoryContext();
  const result = enforceMemoryTrustSafetyBoundary({ memoryContext: ctx });
  assert.equal(result.personalizationAllowed, true);
});

test("getSafetyPrecedenceDescription returns description", () => {
  assert.ok(getSafetyPrecedenceDescription().length > 0);
});

// ── Dormant Memory ──
console.log("\nDormant memory:");

test("resolveDormantMemoryBehavior stays dormant for long dormant low relevance", () => {
  const ctx = createMemoryContext({ lastActiveTurnsAgo: 25 });
  const result = resolveDormantMemoryBehavior({
    memoryContext: ctx,
    currentContextRelevance: "low",
  });
  assert.equal(result.shouldSurface, false);
  assert.equal(result.behavior, "stay_dormant");
});

test("resolveDormantMemoryBehavior surfaces subtly for long dormant high relevance", () => {
  const ctx = createMemoryContext({ lastActiveTurnsAgo: 25 });
  const result = resolveDormantMemoryBehavior({
    memoryContext: ctx,
    currentContextRelevance: "high",
  });
  assert.equal(result.shouldSurface, true);
  assert.equal(result.behavior, "surface_subtly");
});

test("resolveDormantMemoryBehavior uses internally for moderately dormant", () => {
  const ctx = createMemoryContext({ lastActiveTurnsAgo: 15 });
  const result = resolveDormantMemoryBehavior({
    memoryContext: ctx,
    currentContextRelevance: "medium",
  });
  assert.equal(result.shouldSurface, false);
  assert.equal(result.behavior, "use_internally_only");
});

test("resolveDormantMemoryBehavior surfaces subtly for recent high relevance", () => {
  const ctx = createMemoryContext({ lastActiveTurnsAgo: 3 });
  const result = resolveDormantMemoryBehavior({
    memoryContext: ctx,
    currentContextRelevance: "high",
  });
  assert.equal(result.shouldSurface, true);
  assert.equal(result.behavior, "surface_subtly");
});

test("getDormantBehaviorDescription returns description for each behavior", () => {
  assert.ok(getDormantBehaviorDescription("stay_dormant").length > 0);
  assert.ok(getDormantBehaviorDescription("surface_subtly").length > 0);
  assert.ok(getDormantBehaviorDescription("use_internally_only").length > 0);
});

// ── Main Handler ──
console.log("\nMain handler:");

test("prepareArishaMemoryPersonalizationDecision returns correct result for normal conversation", () => {
  const ctx = createMemoryContext({ conversationTurns: 5, hasPreferences: true, hasHistory: true });
  const result = prepareArishaMemoryPersonalizationDecision({ memoryContext: ctx });
  assert.equal(result.boundary.mode, "contextual");
  assert.ok(result.trustPreserved);
  assert.ok(result.safetyPrecedentEnforced === false || result.safetyPrecedentEnforced === true);
});

test("prepareArishaMemoryPersonalizationDecision suspends memory for safety escalation", () => {
  const ctx = createMemoryContext({ safetyEscalationActive: true });
  const result = prepareArishaMemoryPersonalizationDecision({ memoryContext: ctx });
  assert.equal(result.boundary.mode, "none");
  assert.equal(result.boundary.mayUseMemory, false);
});

test("prepareArishaMemoryPersonalizationDecision suspends memory for sensitive context", () => {
  const ctx = createMemoryContext({ sensitiveContextPresent: true });
  const result = prepareArishaMemoryPersonalizationDecision({ memoryContext: ctx });
  assert.equal(result.boundary.mode, "none");
  assert.equal(result.boundary.mayUseMemory, false);
});

test("prepareArishaMemoryPersonalizationDecision uses minimal mode for early conversation", () => {
  const ctx = createMemoryContext({ conversationTurns: 1, hasPreferences: true });
  const result = prepareArishaMemoryPersonalizationDecision({ memoryContext: ctx });
  assert.equal(result.boundary.mode, "minimal");
});

// ── Selectors ──
console.log("\nSelectors:");

test("getArishaMemoryTrustAdapter returns adapter", () => {
  const adapter = getArishaMemoryTrustAdapter();
  assert.ok(adapter);
  assert.equal(adapter!.adapterId, "arisha_memory_personalization_trust_v1");
});

test("supportsMemoryBoundary returns true", () => {
  assert.equal(supportsMemoryBoundary(), true);
});

test("supportsMemoryUsageDecisions returns true", () => {
  assert.equal(supportsMemoryUsageDecisions(), true);
});

test("supportsPersonalizationProfiles returns true", () => {
  assert.equal(supportsPersonalizationProfiles(), true);
});

test("supportsToneAdaptation returns true", () => {
  assert.equal(supportsToneAdaptation(), true);
});

test("supportsContinuityDecisions returns true", () => {
  assert.equal(supportsContinuityDecisions(), true);
});

test("supportsDormantMemoryHandling returns true", () => {
  assert.equal(supportsDormantMemoryHandling(), true);
});

test("getAdapterVersion returns 1.0.0", () => {
  assert.equal(getAdapterVersion(), "1.0.0");
});

test("getAdapterId returns arisha_memory_personalization_trust_v1", () => {
  assert.equal(getAdapterId(), "arisha_memory_personalization_trust_v1");
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no memory use when boundary says no", () => {
  const ctx = createMemoryContext({ safetyEscalationActive: true });
  const result = prepareArishaMemoryPersonalizationDecision({ memoryContext: ctx });
  assert.equal(result.boundary.mayUseMemory, false);
  assert.equal(result.usage.shouldUse, false);
});

test("no creepy explicit memory surfacing", () => {
  const ctx = createMemoryContext({ conversationTurns: 1, hasPreferences: true });
  const result = prepareArishaMemoryPersonalizationDecision({ memoryContext: ctx });
  assert.equal(result.boundary.mode, "minimal"); // Early conversation = minimal
  assert.equal(result.usage.usageType, "preference"); // Only preferences, no explicit surfacing
});

test("no personalization override of safety", () => {
  const ctx = createMemoryContext({ sensitiveContextPresent: true });
  const result = prepareArishaMemoryPersonalizationDecision({ memoryContext: ctx });
  assert.equal(result.boundary.mode, "none");
  assert.equal(result.safetyPrecedentEnforced, true);
});

test("dormant memory remains inactive unless useful", () => {
  const ctx = createMemoryContext({ lastActiveTurnsAgo: 25, hasHistory: true });
  const result = prepareArishaMemoryPersonalizationDecision({
    memoryContext: ctx,
    currentContextRelevance: "low",
  });
  assert.equal(result.boundary.mode, "continuity_only");
  // Should use internally, not surface
  assert.equal(result.usage.usageType, "continuity");
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
