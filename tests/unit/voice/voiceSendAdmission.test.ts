import {
  decideVoiceSendAdmission,
  scoreOpeningQuality,
  scoreCompactness,
  scoreVoiceWorthiness,
  type VoiceSendAdmissionInput,
} from "../../../src/telegram/voiceSendAdmission.js";

// ============================================================================
// Helpers
// ============================================================================

function makeInput(overrides: Partial<VoiceSendAdmissionInput>): VoiceSendAdmissionInput {
  return {
    finalSpokenText: overrides.finalSpokenText ?? "This is a good spoken response.",
    originalDeliveryText: overrides.originalDeliveryText ?? "This is a good spoken response.",
    deliveryMode: overrides.deliveryMode ?? "fast_voice",
    providerChoice: overrides.providerChoice ?? "say_macos",
    responseStyle: overrides.responseStyle ?? "neutral",
    presenceMode: overrides.presenceMode ?? "fresh",
    cadenceMode: overrides.cadenceMode ?? "crisp_direct",
    firstAudioMode: overrides.firstAudioMode ?? "full_response_only",
    reentryMode: overrides.reentryMode ?? "cold_reset",
    interruptionRisk: overrides.interruptionRisk ?? "low",
  };
}

// ============================================================================
// TEST A — Strong compact voice output → send_voice
// ============================================================================

function testStrongCompactVoiceOutput() {
  const input = makeInput({
    finalSpokenText: "Привет! Рад тебя слышать. Как дела?",
    originalDeliveryText: "Привет! Рад тебя слышать. Как дела?",
    deliveryMode: "fast_voice",
    cadenceMode: "warm_compact",
    responseStyle: "warm",
  });

  const decision = decideVoiceSendAdmission(input);

  if (decision.admissionMode !== "send_voice") {
    throw new Error(`Expected send_voice, got ${decision.admissionMode}`);
  }
  if (!decision.shouldSendVoice) {
    throw new Error("shouldSendVoice should be true");
  }
  if (decision.qualityScore < 65) {
    throw new Error(`Quality score too low: ${decision.qualityScore}`);
  }
  if (!decision.hints.includes("spoken_output_is_compact_and_listenable")) {
    throw new Error("Missing spoken_output_is_compact_and_listenable hint");
  }
  if (!decision.hints.includes("opening_quality_good_for_voice")) {
    throw new Error("Missing opening_quality_good_for_voice hint");
  }

  console.log("✅ testStrongCompactVoiceOutput passed");
}

// ============================================================================
// TEST B — Weak/overlong spoken output → downgrade_to_text
// ============================================================================

function testWeakOverlongOutputDowngrade() {
  const longText = "A".repeat(600);
  const input = makeInput({
    finalSpokenText: longText,
    originalDeliveryText: longText,
    deliveryMode: "quality_voice",
    cadenceMode: "crisp_direct",
  });

  const decision = decideVoiceSendAdmission(input);

  if (decision.admissionMode !== "downgrade_to_text") {
    throw new Error(`Expected downgrade_to_text for overlong output, got ${decision.admissionMode}`);
  }
  if (decision.shouldSendVoice) {
    throw new Error("shouldSendVoice should be false for overlong output");
  }
  if (!decision.shouldDowngradeToText) {
    throw new Error("shouldDowngradeToText should be true");
  }
  if (!decision.warnings.includes("spoken_output_too_heavy_for_voice")) {
    throw new Error("Missing spoken_output_too_heavy_for_voice warning");
  }

  console.log("✅ testWeakOverlongOutputDowngrade passed");
}

// ============================================================================
// TEST C — Borderline medium output → send_voice_with_caution
// ============================================================================

function testBorderlineMediumOutput() {
  // Text with weak opening + moderate length
  const input = makeInput({
    finalSpokenText: "ну... это интересный вопрос, который требует некоторого размышления и анализа",
    originalDeliveryText: "Это интересный вопрос, требующий анализа.",
    deliveryMode: "fast_voice",
    cadenceMode: "steady_explanatory",
    responseStyle: "neutral",
  });

  const decision = decideVoiceSendAdmission(input);

  if (decision.admissionMode !== "send_voice_with_caution") {
    throw new Error(`Expected send_voice_with_caution, got ${decision.admissionMode} (score: ${decision.qualityScore})`);
  }
  if (!decision.shouldMarkAsBorderline) {
    throw new Error("shouldMarkAsBorderline should be true");
  }
  if (!decision.shouldSendVoice) {
    throw new Error("shouldSendVoice should be true for borderline");
  }

  console.log("✅ testBorderlineMediumOutput passed");
}

// ============================================================================
// TEST D — Text-only upstream → downgrade_to_text
// ============================================================================

function testTextOnlyUpstream() {
  const input = makeInput({
    deliveryMode: "text_only",
    finalSpokenText: "Some spoken text.",
    originalDeliveryText: "Some spoken text.",
  });

  const decision = decideVoiceSendAdmission(input);

  if (decision.admissionMode !== "downgrade_to_text") {
    throw new Error(`Expected downgrade_to_text for text_only delivery, got ${decision.admissionMode}`);
  }
  if (!decision.shouldDowngradeToText) {
    throw new Error("shouldDowngradeToText should be true");
  }
  if (decision.qualityScore !== 0) {
    throw new Error(`Quality score should be 0 for text_only, got ${decision.qualityScore}`);
  }
  if (!decision.warnings.includes("delivery_mode_not_worth_voice_send")) {
    throw new Error("Missing delivery_mode_not_worth_voice_send warning");
  }

  console.log("✅ testTextOnlyUpstream passed");
}

// ============================================================================
// TEST E — High interruption risk lowers score
// ============================================================================

function testHighInterruptionRiskLowersScore() {
  const baseInput = makeInput({
    finalSpokenText: "This is a somewhat long response that could be interrupted.",
    originalDeliveryText: "This is a somewhat long response that could be interrupted.",
    interruptionRisk: "low",
  });

  const highRiskInput = makeInput({
    finalSpokenText: "This is a somewhat long response that could be interrupted.",
    originalDeliveryText: "This is a somewhat long response that could be interrupted.",
    interruptionRisk: "high",
  });

  const baseDecision = decideVoiceSendAdmission(baseInput);
  const highRiskDecision = decideVoiceSendAdmission(highRiskInput);

  if (highRiskDecision.qualityScore >= baseDecision.qualityScore) {
    throw new Error(
      `High interruption risk should lower score: base=${baseDecision.qualityScore}, high=${highRiskDecision.qualityScore}`,
    );
  }
  if (!highRiskDecision.warnings.includes("high_interruption_risk_for_long_audio")) {
    throw new Error("Missing high_interruption_risk_for_long_audio warning");
  }

  console.log("✅ testHighInterruptionRiskLowersScore passed");
}

// ============================================================================
// TEST F — Fast voice with overloaded text gets penalized
// ============================================================================

function testFastVoiceOverloadedText() {
  const overloadedText = "A".repeat(400);
  const input = makeInput({
    finalSpokenText: overloadedText,
    originalDeliveryText: overloadedText,
    deliveryMode: "fast_voice",
    cadenceMode: "crisp_direct",
  });

  const decision = decideVoiceSendAdmission(input);

  // Fast voice + 400 chars = bad cadence fit
  if (decision.qualityScore > 60) {
    throw new Error(`Fast voice with overloaded text should be penalized, got score ${decision.qualityScore}`);
  }
  if (!decision.warnings.includes("spoken_output_too_heavy_for_voice")) {
    throw new Error("Missing spoken_output_too_heavy_for_voice warning");
  }

  console.log("✅ testFastVoiceOverloadedText passed");
}

// ============================================================================
// TEST G — Deterministic behavior with same inputs
// ============================================================================

function testDeterministicBehavior() {
  const input = makeInput({
    finalSpokenText: "Привет! Как дела? Рад тебя слышать.",
    originalDeliveryText: "Привет! Как дела? Рад тебя слышать.",
    deliveryMode: "quality_voice",
    cadenceMode: "warm_compact",
    responseStyle: "warm",
    interruptionRisk: "low",
  });

  const decision1 = decideVoiceSendAdmission(input);
  const decision2 = decideVoiceSendAdmission(input);

  if (JSON.stringify(decision1) !== JSON.stringify(decision2)) {
    throw new Error("Decision should be deterministic with same inputs");
  }

  console.log("✅ testDeterministicBehavior passed");
}

// ============================================================================
// TEST H — scoreOpeningQuality: strong start
// ============================================================================

function testOpeningQualityStrongStart() {
  const strongStart = scoreOpeningQuality("Привет, как дела?");
  if (strongStart < 70) {
    throw new Error(`Strong opening should score >= 70, got ${strongStart}`);
  }

  console.log("✅ testOpeningQualityStrongStart passed");
}

// ============================================================================
// TEST I — scoreOpeningQuality: weak start
// ============================================================================

function testOpeningQualityWeakStart() {
  const weakStart = scoreOpeningQuality(",начинается с запятой");
  if (weakStart > 50) {
    throw new Error(`Weak opening should score <= 50, got ${weakStart}`);
  }

  console.log("✅ testOpeningQualityWeakStart passed");
}

// ============================================================================
// TEST J — scoreCompactness: optimal range
// ============================================================================

function testCompactnessOptimalRange() {
  const optimal = scoreCompactness("This is a perfectly sized response for voice delivery.");
  if (optimal < 70) {
    throw new Error(`Optimal compactness should score >= 70, got ${optimal}`);
  }

  console.log("✅ testCompactnessOptimalRange passed");
}

// ============================================================================
// TEST K — scoreCompactness: too long
// ============================================================================

function testCompactnessTooLong() {
  const tooLong = scoreCompactness("A".repeat(500));
  if (tooLong > 50) {
    throw new Error(`Very long text compactness should score <= 50, got ${tooLong}`);
  }

  console.log("✅ testCompactnessTooLong passed");
}

// ============================================================================
// TEST L — scoreVoiceWorthiness: identical texts
// ============================================================================

function testVoiceWorthinessIdentical() {
  const score = scoreVoiceWorthiness("Same text here.", "Same text here.");
  if (score < 70) {
    throw new Error(`Identical texts worthiness should score >= 70, got ${score}`);
  }

  console.log("✅ testVoiceWorthinessIdentical passed");
}

// ============================================================================
// TEST M — Empty spoken text → downgrade
// ============================================================================

function testEmptySpokenTextDowngrade() {
  const input = makeInput({
    finalSpokenText: "",
    originalDeliveryText: "Some original text.",
  });

  const decision = decideVoiceSendAdmission(input);

  if (decision.admissionMode !== "downgrade_to_text") {
    throw new Error(`Expected downgrade_to_text for empty spoken text, got ${decision.admissionMode}`);
  }
  if (decision.qualityScore !== 0) {
    throw new Error(`Quality score should be 0 for empty text, got ${decision.qualityScore}`);
  }

  console.log("✅ testEmptySpokenTextDowngrade passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Send Admission Tests ===\n");

try {
  testStrongCompactVoiceOutput();
  testWeakOverlongOutputDowngrade();
  testBorderlineMediumOutput();
  testTextOnlyUpstream();
  testHighInterruptionRiskLowersScore();
  testFastVoiceOverloadedText();
  testDeterministicBehavior();
  testOpeningQualityStrongStart();
  testOpeningQualityWeakStart();
  testCompactnessOptimalRange();
  testCompactnessTooLong();
  testVoiceWorthinessIdentical();
  testEmptySpokenTextDowngrade();

  console.log("\n✅ All voice send admission tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
