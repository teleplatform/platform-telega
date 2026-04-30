import {
  decideVoiceDeliveryPolicy,
  type VoiceDeliveryPolicyInput,
} from "../../../src/telegram/voiceDeliveryPolicy.js";

// ============================================================================
// Helpers
// ============================================================================

function makeInput(overrides: Partial<VoiceDeliveryPolicyInput>): VoiceDeliveryPolicyInput {
  return {
    originalStrategyMode: overrides.originalStrategyMode ?? "voice_fast",
    preferredProvider: overrides.preferredProvider ?? null,
    textLength: overrides.textLength ?? 50,
    answerLength: overrides.answerLength ?? "short",
    taskComplexity: overrides.taskComplexity ?? "low",
    cadenceMode: overrides.cadenceMode ?? "crisp_direct",
    firstAudioMode: overrides.firstAudioMode ?? "full_response_only",
    reentryMode: overrides.reentryMode ?? "cold_reset",
    isFastProviderAvailable: overrides.isFastProviderAvailable ?? true,
    isQualityProviderAvailable: overrides.isQualityProviderAvailable ?? true,
    recentVoiceFailure: overrides.recentVoiceFailure ?? false,
  };
}

// ============================================================================
// TEST A — Short direct turn + first-audio fast → fast_voice
// ============================================================================

function testShortDirectTurnFirstAudioFast() {
  const input = makeInput({
    originalStrategyMode: "voice_fast",
    textLength: 50,
    answerLength: "short",
    cadenceMode: "crisp_direct",
    firstAudioMode: "single_chunk_fast_start",
    reentryMode: "instant_resume",
    isFastProviderAvailable: true,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "fast_voice") {
    throw new Error(`Expected fast_voice, got ${decision.deliveryMode}`);
  }
  if (decision.providerChoice !== "say_macos") {
    throw new Error(`Expected say_macos, got ${decision.providerChoice}`);
  }
  if (!decision.shouldPreferFastPath) {
    throw new Error("shouldPreferFastPath should be true");
  }
  if (!decision.hints.includes("fast_path_best_matches_turn_shape")) {
    throw new Error("Missing fast_path_best_matches_turn_shape hint");
  }

  console.log("✅ testShortDirectTurnFirstAudioFast passed");
}

// ============================================================================
// TEST B — Long supportive/explanatory turn + Kozy available → quality_voice
// ============================================================================

function testLongSupportiveTurnQualityVoice() {
  const input = makeInput({
    originalStrategyMode: "voice_quality",
    textLength: 200,
    answerLength: "long",
    taskComplexity: "high",
    cadenceMode: "supportive_gentle",
    firstAudioMode: "full_response_only",
    reentryMode: "soft_return",
    isFastProviderAvailable: true,
    isQualityProviderAvailable: true,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "quality_voice") {
    throw new Error(`Expected quality_voice, got ${decision.deliveryMode}`);
  }
  if (decision.providerChoice !== "kozy") {
    throw new Error(`Expected kozy, got ${decision.providerChoice}`);
  }
  if (decision.shouldBypassQualityPath) {
    throw new Error("shouldBypassQualityPath should be false for quality-worthy turn");
  }
  if (!decision.hints.includes("quality_path_reserved_for_high-value_voice_turn")) {
    throw new Error("Missing quality_path_reserved_for_high-value_voice_turn hint");
  }

  console.log("✅ testLongSupportiveTurnQualityVoice passed");
}

// ============================================================================
// TEST C — Text-only strategy → text_only
// ============================================================================

function testTextOnlyStrategy() {
  const input = makeInput({
    originalStrategyMode: "text_only",
    textLength: 100,
    answerLength: "medium",
    cadenceMode: "steady_explanatory",
    isFastProviderAvailable: true,
    isQualityProviderAvailable: true,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "text_only") {
    throw new Error(`Expected text_only, got ${decision.deliveryMode}`);
  }
  if (decision.providerChoice !== "none") {
    throw new Error(`Expected none provider, got ${decision.providerChoice}`);
  }
  if (!decision.shouldUseTextInstead) {
    throw new Error("shouldUseTextInstead should be true for text_only strategy");
  }
  if (decision.reasonCode !== "text_is_best_surface") {
    throw new Error(`Expected text_is_best_surface reason, got ${decision.reasonCode}`);
  }

  console.log("✅ testTextOnlyStrategy passed");
}

// ============================================================================
// TEST D — Fast unavailable, quality available → valid fallback
// ============================================================================

function testFastUnavailableQualityAvailable() {
  const input = makeInput({
    originalStrategyMode: "voice_fast",
    textLength: 80,
    answerLength: "short",
    cadenceMode: "crisp_direct",
    isFastProviderAvailable: false,
    isQualityProviderAvailable: true,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "quality_voice") {
    throw new Error(`Expected quality_voice fallback, got ${decision.deliveryMode}`);
  }
  if (decision.providerChoice !== "kozy") {
    throw new Error(`Expected kozy, got ${decision.providerChoice}`);
  }
  if (!decision.warnings.includes("provider_unavailable_delivery_downgraded")) {
    throw new Error("Missing provider_unavailable_delivery_downgraded warning");
  }

  console.log("✅ testFastUnavailableQualityAvailable passed");
}

// ============================================================================
// TEST E — Quality unavailable, fast available → valid fallback
// ============================================================================

function testQualityUnavailableFastAvailable() {
  const input = makeInput({
    originalStrategyMode: "voice_quality",
    textLength: 150,
    answerLength: "medium",
    taskComplexity: "medium",
    cadenceMode: "steady_explanatory",
    isFastProviderAvailable: true,
    isQualityProviderAvailable: false,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "fast_voice") {
    throw new Error(`Expected fast_voice fallback, got ${decision.deliveryMode}`);
  }
  if (decision.providerChoice !== "say_macos") {
    throw new Error(`Expected say_macos, got ${decision.providerChoice}`);
  }
  if (!decision.shouldPreferFastPath) {
    throw new Error("shouldPreferFastPath should be true");
  }
  if (!decision.warnings.includes("provider_unavailable_delivery_downgraded")) {
    throw new Error("Missing provider_unavailable_delivery_downgraded warning");
  }

  console.log("✅ testQualityUnavailableFastAvailable passed");
}

// ============================================================================
// TEST F — Both unavailable → text_only
// ============================================================================

function testBothProvidersUnavailable() {
  const input = makeInput({
    originalStrategyMode: "voice_quality",
    textLength: 100,
    answerLength: "medium",
    isFastProviderAvailable: false,
    isQualityProviderAvailable: false,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "text_only") {
    throw new Error(`Expected text_only when both unavailable, got ${decision.deliveryMode}`);
  }
  if (decision.providerChoice !== "none") {
    throw new Error(`Expected none provider, got ${decision.providerChoice}`);
  }
  if (!decision.shouldUseTextInstead) {
    throw new Error("shouldUseTextInstead should be true");
  }

  console.log("✅ testBothProvidersUnavailable passed");
}

// ============================================================================
// TEST G — Recent failure biases toward fast
// ============================================================================

function testRecentFailureBiasToFast() {
  const input = makeInput({
    originalStrategyMode: "voice_quality",
    textLength: 60,
    answerLength: "short",
    cadenceMode: "crisp_direct",
    firstAudioMode: "single_chunk_fast_start",
    reentryMode: "instant_resume",
    isFastProviderAvailable: true,
    isQualityProviderAvailable: true,
    recentVoiceFailure: true,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "fast_voice") {
    throw new Error(`Expected fast_voice with recent failure, got ${decision.deliveryMode}`);
  }
  if (!decision.hints.includes("failure_history_bias_to_fast")) {
    throw new Error("Missing failure_history_bias_to_fast hint");
  }
  if (!decision.shouldBypassQualityPath) {
    throw new Error("shouldBypassQualityPath should be true with recent failure + fast shape");
  }

  console.log("✅ testRecentFailureBiasToFast passed");
}

// ============================================================================
// TEST H — Deterministic behavior with same inputs
// ============================================================================

function testDeterministicBehavior() {
  const input = makeInput({
    originalStrategyMode: "voice_quality",
    textLength: 200,
    answerLength: "long",
    taskComplexity: "high",
    cadenceMode: "soft_guided",
    firstAudioMode: "full_response_only",
    reentryMode: "soft_return",
    isFastProviderAvailable: true,
    isQualityProviderAvailable: true,
  });

  const decision1 = decideVoiceDeliveryPolicy(input);
  const decision2 = decideVoiceDeliveryPolicy(input);

  if (JSON.stringify(decision1) !== JSON.stringify(decision2)) {
    throw new Error("Decision should be deterministic with same inputs");
  }

  console.log("✅ testDeterministicBehavior passed");
}

// ============================================================================
// TEST I — Text too small for voice
// ============================================================================

function testTextTooSmall() {
  const input = makeInput({
    originalStrategyMode: "voice_fast",
    textLength: 5,
    answerLength: "short",
    isFastProviderAvailable: true,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "text_only") {
    throw new Error(`Expected text_only for tiny text, got ${decision.deliveryMode}`);
  }
  if (decision.reasonCode !== "reply_too_small_for_voice") {
    throw new Error(`Expected reply_too_small_for_voice reason, got ${decision.reasonCode}`);
  }

  console.log("✅ testTextTooSmall passed");
}

// ============================================================================
// TEST J — Text too large for quality voice
// ============================================================================

function testTextTooLargeForQuality() {
  const input = makeInput({
    originalStrategyMode: "voice_quality",
    textLength: 600,
    answerLength: "long",
    taskComplexity: "high",
    isFastProviderAvailable: true,
    isQualityProviderAvailable: true,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "text_only") {
    throw new Error(`Expected text_only for oversized text, got ${decision.deliveryMode}`);
  }
  if (decision.reasonCode !== "reply_too_large_for_quality") {
    throw new Error(`Expected reply_too_large_for_quality reason, got ${decision.reasonCode}`);
  }
  if (!decision.warnings.includes("oversized_turn_not_good_for_current_voice_runtime")) {
    throw new Error("Missing oversized_turn warning");
  }

  console.log("✅ testTextTooLargeForQuality passed");
}

// ============================================================================
// TEST K — Reentry favors fast over quality
// ============================================================================

function testReentryFavorsFast() {
  const input = makeInput({
    originalStrategyMode: "voice_quality",
    textLength: 100,
    answerLength: "medium",
    cadenceMode: "warm_compact",
    firstAudioMode: "single_chunk_fast_start",
    reentryMode: "instant_resume",
    isFastProviderAvailable: true,
    isQualityProviderAvailable: true,
  });

  const decision = decideVoiceDeliveryPolicy(input);

  if (decision.deliveryMode !== "fast_voice") {
    throw new Error(`Expected fast_voice for fast reentry, got ${decision.deliveryMode}`);
  }
  if (decision.reasonCode !== "first_audio_favors_fast") {
    throw new Error(`Expected first_audio_favors_fast reason, got ${decision.reasonCode}`);
  }
  if (!decision.hints.includes("reentry_should_not_wait_for_slow_voice")) {
    throw new Error("Missing reentry_should_not_wait_for_slow_voice hint");
  }

  console.log("✅ testReentryFavorsFast passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Delivery Policy Tests ===\n");

try {
  testShortDirectTurnFirstAudioFast();
  testLongSupportiveTurnQualityVoice();
  testTextOnlyStrategy();
  testFastUnavailableQualityAvailable();
  testQualityUnavailableFastAvailable();
  testBothProvidersUnavailable();
  testRecentFailureBiasToFast();
  testDeterministicBehavior();
  testTextTooSmall();
  testTextTooLargeForQuality();
  testReentryFavorsFast();

  console.log("\n✅ All voice delivery policy tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
