import {
  decideVoiceSessionReentry,
  isDirectShortInput,
  isSoftFollowupLikeInput,
  normalizeGap,
  type VoiceSessionReentryInput,
} from "../../../src/telegram/voiceSessionReentry.js";

// ============================================================================
// Helpers
// ============================================================================

const BASE_TIME = 1_700_000_000_000; // Fixed base time for determinism

const INSTANT_WINDOW = 90_000;
const SOFT_WINDOW = 8 * 60_000;
const PRACTICAL_WINDOW = 35 * 60_000;

function makeInput(overrides: Partial<VoiceSessionReentryInput>): VoiceSessionReentryInput {
  return {
    chatId: overrides.chatId ?? 12345,
    nowMs: overrides.nowMs ?? BASE_TIME + 1000,
    inputText: overrides.inputText ?? "Как дела?",
    presenceMode: overrides.presenceMode ?? "continuing",
    responseStyle: overrides.responseStyle ?? "warm",
    cadenceMode: overrides.cadenceMode ?? "warm_compact",
    isFollowUp: overrides.isFollowUp ?? true,
    continuityCarryMode: overrides.continuityCarryMode ?? "inherit_recent",
    lastVoiceAtMs: overrides.lastVoiceAtMs ?? BASE_TIME,
  };
}

// ============================================================================
// TEST A — Short pause + continuing → instant_resume
// ============================================================================

function testShortPauseContinuing() {
  const input = makeInput({
    chatId: 100,
    lastVoiceAtMs: BASE_TIME,
    nowMs: BASE_TIME + 60_000, // 60 second gap — within instant window
    inputText: "А что дальше?",
    presenceMode: "continuing",
    isFollowUp: true,
    continuityCarryMode: "inherit_recent",
  });

  const decision = decideVoiceSessionReentry(input);

  if (decision.reentryMode !== "instant_resume") {
    throw new Error(`Expected instant_resume, got ${decision.reentryMode}`);
  }
  if (!decision.allowWarmReentry) {
    throw new Error("allowWarmReentry should be true for instant resume");
  }
  if (!decision.allowContinuityWording) {
    throw new Error("allowContinuityWording should be true for instant resume");
  }
  if (decision.shouldCleanStart) {
    throw new Error("shouldCleanStart should be false for instant resume");
  }

  console.log("✅ testShortPauseContinuing passed");
}

// ============================================================================
// TEST B — Recent pause + warm follow-up → soft_return or warm_reentry
// ============================================================================

function testRecentPauseWarmFollowup() {
  const input = makeInput({
    chatId: 200,
    lastVoiceAtMs: BASE_TIME,
    nowMs: BASE_TIME + 3 * 60_000, // 3 minutes — within soft window
    inputText: "Спасибо, это помогает. Расскажи подробнее.",
    presenceMode: "continuing",
    responseStyle: "warm",
    isFollowUp: true,
    continuityCarryMode: "inherit_recent",
  });

  const decision = decideVoiceSessionReentry(input);

  // Should be either soft_return or warm_reentry (warm_reentry is more specific)
  if (decision.reentryMode !== "warm_reentry" && decision.reentryMode !== "soft_return") {
    throw new Error(`Expected warm_reentry or soft_return, got ${decision.reentryMode}`);
  }
  if (!decision.allowWarmReentry) {
    throw new Error("allowWarmReentry should be true for recent warm follow-up");
  }
  if (!decision.allowContinuityWording) {
    throw new Error("allowContinuityWording should be true for recent warm follow-up");
  }

  console.log("✅ testRecentPauseWarmFollowup passed");
}

// ============================================================================
// TEST C — Medium pause → practical_rejoin
// ============================================================================

function testMediumPause() {
  const input = makeInput({
    chatId: 300,
    lastVoiceAtMs: BASE_TIME,
    nowMs: BASE_TIME + 20 * 60_000, // 20 minutes — beyond soft, within practical
    inputText: "Расскажи ещё про это.",
    presenceMode: "continuing",
    responseStyle: "neutral",
    isFollowUp: true,
    continuityCarryMode: "soft_reset",
  });

  const decision = decideVoiceSessionReentry(input);

  if (decision.reentryMode !== "practical_rejoin") {
    throw new Error(`Expected practical_rejoin, got ${decision.reentryMode}`);
  }
  if (decision.allowWarmReentry) {
    throw new Error("allowWarmReentry should be false for practical_rejoin");
  }
  if (decision.allowContinuityWording) {
    throw new Error("allowContinuityWording should be false for practical_rejoin");
  }
  if (!decision.shouldCleanStart) {
    throw new Error("shouldCleanStart should be true for practical_rejoin");
  }
  if (!decision.warnings.includes("continuity_stale_for_warm_reentry")) {
    throw new Error("Missing continuity_stale_for_warm_reentry warning");
  }

  console.log("✅ testMediumPause passed");
}

// ============================================================================
// TEST D — Long pause → cold_reset
// ============================================================================

function testLongPause() {
  const input = makeInput({
    chatId: 400,
    lastVoiceAtMs: BASE_TIME,
    nowMs: BASE_TIME + 50 * 60_000, // 50 minutes — beyond practical window
    inputText: "Привет, можно продолжить?",
    presenceMode: "fresh",
    responseStyle: "neutral",
    isFollowUp: false,
    continuityCarryMode: "hard_reset",
  });

  const decision = decideVoiceSessionReentry(input);

  if (decision.reentryMode !== "cold_reset") {
    throw new Error(`Expected cold_reset, got ${decision.reentryMode}`);
  }
  if (decision.allowWarmReentry) {
    throw new Error("allowWarmReentry should be false for cold_reset");
  }
  if (decision.allowContinuityWording) {
    throw new Error("allowContinuityWording should be false for cold_reset");
  }
  if (!decision.shouldCleanStart) {
    throw new Error("shouldCleanStart should be true for cold_reset");
  }
  if (!decision.shouldBiasTowardFreshOpening) {
    throw new Error("shouldBiasTowardFreshOpening should be true for cold_reset");
  }
  if (!decision.shouldAvoidAssumedContinuity) {
    throw new Error("shouldAvoidAssumedContinuity should be true for cold_reset");
  }

  console.log("✅ testLongPause passed");
}

// ============================================================================
// TEST E — Reset presence → cold_reset
// ============================================================================

function testResetPresence() {
  const input = makeInput({
    chatId: 500,
    lastVoiceAtMs: BASE_TIME,
    nowMs: BASE_TIME + 30_000, // Very recent
    inputText: "Новый вопрос",
    presenceMode: "reset",
    responseStyle: "warm",
    isFollowUp: false,
    continuityCarryMode: "inherit_recent",
  });

  const decision = decideVoiceSessionReentry(input);

  if (decision.reentryMode !== "cold_reset") {
    throw new Error(`Expected cold_reset for reset presence, got ${decision.reentryMode}`);
  }
  if (!decision.shouldCleanStart) {
    throw new Error("shouldCleanStart should be true for reset presence");
  }
  if (!decision.warnings.includes("reset_presence_blocks_continuity_wording")) {
    throw new Error("Missing reset_presence_blocks_continuity_wording warning");
  }

  console.log("✅ testResetPresence passed");
}

// ============================================================================
// TEST F — Direct short input suppresses warm reentry
// ============================================================================

function testDirectShortInputSuppressesWarm() {
  const input = makeInput({
    chatId: 600,
    lastVoiceAtMs: BASE_TIME,
    nowMs: BASE_TIME + 30_000, // Recent
    inputText: "да",
    presenceMode: "continuing",
    responseStyle: "warm",
    isFollowUp: true,
    continuityCarryMode: "inherit_recent",
  });

  const decision = decideVoiceSessionReentry(input);

  // Direct input should suppress warm reentry — either instant_resume or practical_rejoin
  if (decision.reentryMode === "warm_reentry") {
    throw new Error("warm_reentry should be suppressed for direct short input");
  }
  if (!decision.warnings.includes("direct_input_suppresses_soft_reentry")) {
    throw new Error("Missing direct_input_suppresses_soft_reentry warning");
  }

  console.log("✅ testDirectShortInputSuppressesWarm passed");
}

// ============================================================================
// TEST G — Soft human follow-up allows warm reentry only if recent
// ============================================================================

function testSoftFollowupAllowsWarmReentryIfRecent() {
  // Recent gap — should allow warm_reentry
  const recentInput = makeInput({
    chatId: 700,
    lastVoiceAtMs: BASE_TIME,
    nowMs: BASE_TIME + 5 * 60_000, // 5 minutes — within soft window
    inputText: "Спасибо за помощь, это очень полезно.",
    presenceMode: "continuing",
    responseStyle: "supportive",
    isFollowUp: true,
    continuityCarryMode: "inherit_recent",
  });

  const recentDecision = decideVoiceSessionReentry(recentInput);

  if (recentDecision.reentryMode !== "warm_reentry") {
    throw new Error(`Expected warm_reentry for recent soft follow-up, got ${recentDecision.reentryMode}`);
  }
  if (!recentDecision.allowWarmReentry) {
    throw new Error("allowWarmReentry should be true for recent soft follow-up");
  }

  // Stale gap — should NOT allow warm_reentry
  const staleInput = makeInput({
    chatId: 700,
    lastVoiceAtMs: BASE_TIME,
    nowMs: BASE_TIME + 40 * 60_000, // 40 minutes — beyond practical window
    inputText: "Спасибо за помощь, это очень полезно.",
    presenceMode: "continuing",
    responseStyle: "supportive",
    isFollowUp: true,
    continuityCarryMode: "hard_reset",
  });

  const staleDecision = decideVoiceSessionReentry(staleInput);

  if (staleDecision.reentryMode === "warm_reentry") {
    throw new Error(`warm_reentry should NOT be allowed for stale gap, got ${staleDecision.reentryMode}`);
  }

  console.log("✅ testSoftFollowupAllowsWarmReentryIfRecent passed");
}

// ============================================================================
// TEST H — Deterministic behavior with same inputs
// ============================================================================

function testDeterministicBehavior() {
  const input = makeInput({
    chatId: 800,
    lastVoiceAtMs: BASE_TIME,
    nowMs: BASE_TIME + 2 * 60_000,
    inputText: "Продолжай, интересно.",
    presenceMode: "continuing",
    responseStyle: "warm",
    isFollowUp: true,
    continuityCarryMode: "inherit_recent",
  });

  const decision1 = decideVoiceSessionReentry(input);
  const decision2 = decideVoiceSessionReentry(input);

  if (JSON.stringify(decision1) !== JSON.stringify(decision2)) {
    throw new Error("Decision should be deterministic with same inputs");
  }

  console.log("✅ testDeterministicBehavior passed");
}

// ============================================================================
// TEST I — Heuristic: isDirectShortInput
// ============================================================================

function testIsDirectShortInput() {
  // Direct patterns
  if (!isDirectShortInput("да")) throw new Error("Should detect direct: да");
  if (!isDirectShortInput("ок")) throw new Error("Should detect direct: ок");
  if (!isDirectShortInput("продолжай")) throw new Error("Should detect direct: продолжай");
  if (!isDirectShortInput("делай")) throw new Error("Should detect direct: делай");
  if (!isDirectShortInput("ну")) throw new Error("Should detect direct: ну");
  if (!isDirectShortInput("дальше")) throw new Error("Should detect direct: дальше");
  if (!isDirectShortInput("yes")) throw new Error("Should detect direct: yes");
  if (!isDirectShortInput("go")) throw new Error("Should detect direct: go");

  // Not direct
  if (isDirectShortInput("Расскажи мне подробнее об этом")) throw new Error("Should not detect direct for long text");
  if (isDirectShortInput("А что ты думаешь?")) throw new Error("Should not detect direct for question");

  console.log("✅ testIsDirectShortInput passed");
}

// ============================================================================
// TEST J — Heuristic: isSoftFollowupLikeInput
// ============================================================================

function testIsSoftFollowupLikeInput() {
  // Soft patterns
  if (!isSoftFollowupLikeInput("Спасибо, это помогает.")) throw new Error("Should detect soft: спасибо");
  if (!isSoftFollowupLikeInput("Давай продолжим.")) throw new Error("Should detect soft: давай продолжим");
  if (!isSoftFollowupLikeInput("Хорошо, расскажи ещё.")) throw new Error("Should detect soft: хорошо");
  if (!isSoftFollowupLikeInput("Thanks, that helps.")) throw new Error("Should detect soft: thanks");

  // Not soft
  if (isSoftFollowupLikeInput("да")) throw new Error("Should not detect soft for direct input");
  if (isSoftFollowupLikeInput("сделай это")) throw new Error("Should not detect soft for command");

  console.log("✅ testIsSoftFollowupLikeInput passed");
}

// ============================================================================
// TEST K — Heuristic: normalizeGap
// ============================================================================

function testNormalizeGap() {
  const now = BASE_TIME + 100_000;

  // Normal gap
  const gap1 = normalizeGap(now, BASE_TIME);
  if (gap1 !== 100_000) throw new Error(`Expected 100000, got ${gap1}`);

  // Null lastVoiceAtMs
  const gap2 = normalizeGap(now, null);
  if (gap2 !== null) throw new Error("Expected null for null lastVoiceAtMs");

  // Undefined lastVoiceAtMs
  const gap3 = normalizeGap(now, undefined);
  if (gap3 !== null) throw new Error("Expected null for undefined lastVoiceAtMs");

  // Negative gap (clock skew)
  const gap4 = normalizeGap(BASE_TIME, BASE_TIME + 100_000);
  if (gap4 !== null) throw new Error("Expected null for negative gap");

  console.log("✅ testNormalizeGap passed");
}

// ============================================================================
// TEST L — No gap data → cold_reset
// ============================================================================

function testNoGapData() {
  const decision = decideVoiceSessionReentry({
    chatId: 900,
    nowMs: BASE_TIME,
    inputText: "Привет!",
    lastVoiceAtMs: null, // No prior voice turn
  });

  if (decision.reentryMode !== "cold_reset") {
    throw new Error(`Expected cold_reset for no gap data, got ${decision.reentryMode}`);
  }
  if (!decision.shouldCleanStart) {
    throw new Error("shouldCleanStart should be true when no gap data");
  }
  if (!decision.shouldBiasTowardFreshOpening) {
    throw new Error("shouldBiasTowardFreshOpening should be true when no gap data");
  }

  console.log("✅ testNoGapData passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Session Re-Entry Tests ===\n");

try {
  testShortPauseContinuing();
  testRecentPauseWarmFollowup();
  testMediumPause();
  testLongPause();
  testResetPresence();
  testDirectShortInputSuppressesWarm();
  testSoftFollowupAllowsWarmReentryIfRecent();
  testDeterministicBehavior();
  testIsDirectShortInput();
  testIsSoftFollowupLikeInput();
  testNormalizeGap();
  testNoGapData();

  console.log("\n✅ All voice session re-entry tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
