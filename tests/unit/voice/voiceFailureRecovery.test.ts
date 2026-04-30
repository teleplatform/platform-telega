import {
  decideVoiceFailureRecovery,
  shapeFallbackTextForContinuity,
  type VoiceFailureRecoveryInput,
} from "../../../src/telegram/voiceFailureRecovery.js";

// ============================================================================
// Helpers
// ============================================================================

function makeInput(overrides: Partial<VoiceFailureRecoveryInput>): VoiceFailureRecoveryInput {
  return {
    failureMode: overrides.failureMode ?? "provider_error",
    responseStyle: overrides.responseStyle ?? "neutral",
    presenceMode: overrides.presenceMode ?? "fresh",
    cadenceMode: overrides.cadenceMode ?? "steady_explanatory",
    reentryMode: overrides.reentryMode ?? "cold_reset",
    isVoiceStillCurrent: overrides.isVoiceStillCurrent ?? true,
    isSuperseded: overrides.isSuperseded ?? false,
    fallbackText: overrides.fallbackText ?? "This is the response text.",
  };
}

// ============================================================================
// TEST A — Provider error + current turn → clean text fallback
// ============================================================================

function testProviderErrorCurrentTurn() {
  const input = makeInput({
    failureMode: "provider_error",
    responseStyle: "neutral",
    presenceMode: "fresh",
    cadenceMode: "steady_explanatory",
    isVoiceStillCurrent: true,
    isSuperseded: false,
    fallbackText: "Hello, how can I help?",
  });

  const decision = decideVoiceFailureRecovery(input);

  if (decision.fallbackMode !== "clean_text_fallback") {
    throw new Error(`Expected clean_text_fallback, got ${decision.fallbackMode}`);
  }
  if (!decision.shouldSendTextFallback) {
    throw new Error("shouldSendTextFallback should be true");
  }
  if (decision.shouldPreserveContinuityTone) {
    throw new Error("shouldPreserveContinuityTone should be false for neutral context");
  }
  if (decision.shouldStoreContinuitySnapshot) {
    throw new Error("shouldStoreContinuitySnapshot should be false — voice failed");
  }
  if (decision.finalFallbackText !== "Hello, how can I help?") {
    throw new Error(`Unexpected finalFallbackText: ${decision.finalFallbackText}`);
  }

  console.log("✅ testProviderErrorCurrentTurn passed");
}

// ============================================================================
// TEST B — Supportive continuing context + current turn → continuity-preserving text fallback
// ============================================================================

function testSupportiveContinuingContext() {
  const input = makeInput({
    failureMode: "provider_error",
    responseStyle: "supportive",
    presenceMode: "continuing",
    cadenceMode: "supportive_gentle",
    reentryMode: "soft_return",
    isVoiceStillCurrent: true,
    isSuperseded: false,
    fallbackText: "I understand this is difficult. We'll work through it together.",
  });

  const decision = decideVoiceFailureRecovery(input);

  if (decision.fallbackMode !== "continuity_preserving_text_fallback") {
    throw new Error(`Expected continuity_preserved_text_fallback, got ${decision.fallbackMode}`);
  }
  if (!decision.shouldSendTextFallback) {
    throw new Error("shouldSendTextFallback should be true");
  }
  if (!decision.shouldPreserveContinuityTone) {
    throw new Error("shouldPreserveContinuityTone should be true for supportive continuing context");
  }
  if (decision.shouldStoreContinuitySnapshot) {
    throw new Error("shouldStoreContinuitySnapshot should be false — voice failed, RULE E");
  }
  if (!decision.warnings.includes("continuity_memory_not_stored_for_failed_voice")) {
    throw new Error("Missing continuity_memory_not_stored_for_failed_voice warning");
  }

  console.log("✅ testSupportiveContinuingContext passed");
}

// ============================================================================
// TEST C — Superseded voice → silent abort
// ============================================================================

function testSupersededVoiceSilentAbort() {
  const input = makeInput({
    failureMode: "provider_error",
    isVoiceStillCurrent: false,
    isSuperseded: true,
    fallbackText: "This text should not be sent",
  });

  const decision = decideVoiceFailureRecovery(input);

  if (decision.fallbackMode !== "silent_abort") {
    throw new Error(`Expected silent_abort for superseded voice, got ${decision.fallbackMode}`);
  }
  if (decision.shouldSendTextFallback) {
    throw new Error("shouldSendTextFallback should be false for superseded voice");
  }
  if (decision.finalFallbackText !== null) {
    throw new Error("finalFallbackText should be null for superseded voice");
  }
  if (!decision.shouldSuppressFailureSurface) {
    throw new Error("shouldSuppressFailureSurface should be true");
  }
  if (!decision.warnings.includes("stale_voice_must_not_fallback_to_text")) {
    throw new Error("Missing stale_voice_must_not_fallback_to_text warning");
  }

  console.log("✅ testSupersededVoiceSilentAbort passed");
}

// ============================================================================
// TEST D — Direct concise context → clean text fallback, no softness
// ============================================================================

function testDirectConciseCleanFallback() {
  const input = makeInput({
    failureMode: "provider_error",
    responseStyle: "concise",
    presenceMode: "fresh",
    cadenceMode: "crisp_direct",
    reentryMode: "cold_reset",
    isVoiceStillCurrent: true,
    isSuperseded: false,
    fallbackText: "Done. Here's the result.",
  });

  const decision = decideVoiceFailureRecovery(input);

  if (decision.fallbackMode !== "clean_text_fallback") {
    throw new Error(`Expected clean_text_fallback for concise context, got ${decision.fallbackMode}`);
  }
  if (!decision.shouldSendTextFallback) {
    throw new Error("shouldSendTextFallback should be true");
  }
  if (decision.shouldPreserveContinuityTone) {
    throw new Error("shouldPreserveContinuityTone should be false for concise context");
  }
  if (!decision.hints.includes("direct_context_prefers_clean_degradation")) {
    throw new Error("Missing direct_context_prefers_clean_degradation hint");
  }

  console.log("✅ testDirectConciseCleanFallback passed");
}

// ============================================================================
// TEST E — Failed voice does not store continuity snapshot
// ============================================================================

function testFailedVoiceNoContinuitySnapshot() {
  const inputs = [
    makeInput({ failureMode: "provider_error", isVoiceStillCurrent: true }),
    makeInput({ failureMode: "audio_missing", isVoiceStillCurrent: true }),
    makeInput({ failureMode: "audio_too_small", isVoiceStillCurrent: true }),
    makeInput({ failureMode: "synthesis_timeout", isVoiceStillCurrent: true }),
    makeInput({ failureMode: "quality_degraded", isVoiceStillCurrent: true }),
  ];

  for (const input of inputs) {
    const decision = decideVoiceFailureRecovery(input);
    if (decision.shouldStoreContinuitySnapshot) {
      throw new Error(`shouldStoreContinuitySnapshot should be false for ${input.failureMode}`);
    }
  }

  console.log("✅ testFailedVoiceNoContinuitySnapshot passed");
}

// ============================================================================
// TEST F — Deterministic behavior with same inputs
// ============================================================================

function testDeterministicBehavior() {
  const input = makeInput({
    failureMode: "provider_error",
    responseStyle: "warm",
    presenceMode: "continuing",
    cadenceMode: "warm_compact",
    reentryMode: "soft_return",
    isVoiceStillCurrent: true,
    isSuperseded: false,
    fallbackText: "Warm continuing text.",
  });

  const decision1 = decideVoiceFailureRecovery(input);
  const decision2 = decideVoiceFailureRecovery(input);

  if (JSON.stringify(decision1) !== JSON.stringify(decision2)) {
    throw new Error("Decision should be deterministic with same inputs");
  }

  console.log("✅ testDeterministicBehavior passed");
}

// ============================================================================
// TEST G — No apology injection
// ============================================================================

function testNoApologyInjection() {
  const input = makeInput({
    failureMode: "provider_error",
    responseStyle: "supportive",
    presenceMode: "continuing",
    cadenceMode: "supportive_gentle",
    reentryMode: "soft_return",
    isVoiceStillCurrent: true,
    isSuperseded: false,
    fallbackText: "Here is the information you asked for.",
  });

  const decision = decideVoiceFailureRecovery(input);
  const shapedText = decision.finalFallbackText ?? "";

  // Should not contain apology phrases
  const apologyPatterns = [/sorry/i, /извини/i, /ошибка/i, /не получилось/i, /попробую снова/i];
  for (const pattern of apologyPatterns) {
    if (pattern.test(shapedText)) {
      throw new Error(`Apology detected in fallback text: ${pattern.source}`);
    }
  }

  // Should preserve original meaning
  if (!shapedText.includes("information") && !shapedText.includes("информаци")) {
    throw new Error("Original meaning should be preserved in fallback text");
  }

  console.log("✅ testNoApologyInjection passed");
}

// ============================================================================
// TEST H — Reset / cold reentry blocks warm fallback
// ============================================================================

function testResetColdReentryBlocksWarmFallback() {
  const input = makeInput({
    failureMode: "provider_error",
    responseStyle: "warm",
    presenceMode: "reset",
    cadenceMode: "warm_compact",
    reentryMode: "cold_reset",
    isVoiceStillCurrent: true,
    isSuperseded: false,
    fallbackText: "Warm text that should not be softly delivered.",
  });

  const decision = decideVoiceFailureRecovery(input);

  if (decision.fallbackMode === "continuity_preserving_text_fallback") {
    throw new Error("continuity_preserving_text_fallback should NOT be used for cold reset");
  }
  if (!decision.warnings.includes("reset_context_blocks_soft_fallback")) {
    throw new Error("Missing reset_context_blocks_soft_fallback warning");
  }

  console.log("✅ testResetColdReentryBlocksWarmFallback passed");
}

// ============================================================================
// TEST I — Text shaping: warm/supportive adds period if missing
// ============================================================================

function testWarmTextShapingAddsPeriod() {
  const shapedWarm = shapeFallbackTextForContinuity(
    "This is warm text without ending",
    makeInput({ responseStyle: "warm" }),
  );

  if (!/[.!?]$/.test(shapedWarm)) {
    throw new Error("Warm text without ending should get a period");
  }

  console.log("✅ testWarmTextShapingAddsPeriod passed");
}

// ============================================================================
// TEST J — Text shaping: direct/concise keeps clean, no additions
// ============================================================================

function testDirectTextShapingKeepsClean() {
  const original = "Done.";
  const shaped = shapeFallbackTextForContinuity(
    original,
    makeInput({ responseStyle: "concise", cadenceMode: "crisp_direct" }),
  );

  if (shaped !== original) {
    throw new Error(`Direct text should be unchanged, got: "${shaped}"`);
  }

  console.log("✅ testDirectTextShapingKeepsClean passed");
}

// ============================================================================
// TEST K — Stale cancelled → silent abort
// ============================================================================

function testStaleCancelledSilentAbort() {
  const input = makeInput({
    failureMode: "stale_cancelled",
    isVoiceStillCurrent: false,
    isSuperseded: true,
    fallbackText: "This should not be sent",
  });

  const decision = decideVoiceFailureRecovery(input);

  if (decision.fallbackMode !== "silent_abort") {
    throw new Error(`Expected silent_abort for stale_cancelled, got ${decision.fallbackMode}`);
  }
  if (decision.shouldSendTextFallback) {
    throw new Error("shouldSendTextFallback should be false for stale_cancelled");
  }
  if (!decision.hints.includes("stale_voice_should_disappear_quietly")) {
    throw new Error("Missing stale_voice_should_disappear_quietly hint");
  }

  console.log("✅ testStaleCancelledSilentAbort passed");
}

// ============================================================================
// TEST L — Long text is compacted to 300 chars
// ============================================================================

function testLongTextCompacted() {
  const longText = "A".repeat(500);
  const shaped = shapeFallbackTextForContinuity(longText, makeInput({}));

  if (shaped.length > 300) {
    throw new Error(`Long text should be compacted to 300, got ${shaped.length}`);
  }

  console.log("✅ testLongTextCompacted passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Failure Recovery Tests ===\n");

try {
  testProviderErrorCurrentTurn();
  testSupportiveContinuingContext();
  testSupersededVoiceSilentAbort();
  testDirectConciseCleanFallback();
  testFailedVoiceNoContinuitySnapshot();
  testDeterministicBehavior();
  testNoApologyInjection();
  testResetColdReentryBlocksWarmFallback();
  testWarmTextShapingAddsPeriod();
  testDirectTextShapingKeepsClean();
  testStaleCancelledSilentAbort();
  testLongTextCompacted();

  console.log("\n✅ All voice failure recovery tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
