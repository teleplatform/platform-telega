import {
  decideVoiceContinuity,
  rememberVoiceContinuity,
  getRecentVoiceContinuity,
  clearVoiceContinuity,
  resetAllVoiceContinuity,
  getVoiceContinuityMapSize,
  type VoiceContinuitySnapshot,
  type VoiceContinuityDecision,
} from "../../../src/telegram/voiceContinuityMemory.js";

// ============================================================================
// Helpers
// ============================================================================

const BASE_TIME = 1_700_000_000_000; // Fixed base time for determinism

function makeSnapshot(overrides: Partial<VoiceContinuitySnapshot>): VoiceContinuitySnapshot {
  return {
    chatId: overrides.chatId ?? 12345,
    storedAtMs: overrides.storedAtMs ?? BASE_TIME,
    responseStyle: overrides.responseStyle ?? "warm",
    presenceMode: overrides.presenceMode ?? "continuing",
    cadenceMode: overrides.cadenceMode ?? "warm_compact",
    assemblyMode: overrides.assemblyMode ?? "soft_spoken",
    smoothingEntryMode: overrides.smoothingEntryMode ?? "soft_continuation_entry",
    smoothingExitMode: overrides.smoothingExitMode ?? "soft_landing",
  };
}

function defaultDecision(): VoiceContinuityDecision {
  return {
    carryMode: "hard_reset",
    shouldInheritStyle: false,
    shouldInheritCadenceBias: false,
    shouldInheritWarmth: false,
    shouldInheritSupportiveTone: false,
    shouldResetToNeutral: true,
    hints: [],
    warnings: ["no_recent_voice_snapshot"],
  };
}

// ============================================================================
// Cleanup helper
// ============================================================================

function resetAndCleanup() {
  resetAllVoiceContinuity();
}

// ============================================================================
// TEST A — Recent follow-up → inherit_recent
// ============================================================================

function testRecentFollowUpInheritRecent() {
  resetAndCleanup();

  const snapshot = makeSnapshot({
    chatId: 100,
    storedAtMs: BASE_TIME,
    responseStyle: "warm",
    presenceMode: "continuing",
    cadenceMode: "warm_compact",
  });
  rememberVoiceContinuity(snapshot);

  const decision = decideVoiceContinuity({
    chatId: 100,
    nowMs: BASE_TIME + 60_000, // 1 minute gap
    nextPresenceMode: "continuing",
    nextResponseStyle: "warm",
    isFollowUp: true,
  });

  if (decision.carryMode !== "inherit_recent") {
    throw new Error(`Expected inherit_recent, got ${decision.carryMode}`);
  }
  if (!decision.shouldInheritStyle) {
    throw new Error("shouldInheritStyle should be true for recent follow-up");
  }
  if (!decision.shouldInheritWarmth) {
    throw new Error("shouldInheritWarmth should be true after warm style");
  }
  if (!decision.hints.includes("continuity_bias_applied")) {
    throw new Error("Missing continuity_bias_applied hint");
  }

  console.log("✅ testRecentFollowUpInheritRecent passed");
}

// ============================================================================
// TEST B — Reset presence → hard_reset
// ============================================================================

function testResetPresenceForcesHardReset() {
  resetAndCleanup();

  const snapshot = makeSnapshot({
    chatId: 200,
    storedAtMs: BASE_TIME,
    responseStyle: "supportive",
    presenceMode: "soft_followup",
    cadenceMode: "supportive_gentle",
  });
  rememberVoiceContinuity(snapshot);

  const decision = decideVoiceContinuity({
    chatId: 200,
    nowMs: BASE_TIME + 30_000, // 30 second gap — very recent
    nextPresenceMode: "reset",
    nextResponseStyle: "neutral",
    isFollowUp: false,
  });

  if (decision.carryMode !== "hard_reset") {
    throw new Error(`Expected hard_reset for reset presence, got ${decision.carryMode}`);
  }
  if (!decision.shouldResetToNeutral) {
    throw new Error("shouldResetToNeutral should be true for reset presence");
  }
  if (decision.shouldInheritStyle || decision.shouldInheritWarmth || decision.shouldInheritSupportiveTone) {
    throw new Error("No inheritance should be allowed for reset presence");
  }
  if (!decision.warnings.includes("reset_presence_forces_neutral")) {
    throw new Error("Missing reset_presence_forces_neutral warning");
  }

  console.log("✅ testResetPresenceForcesHardReset passed");
}

// ============================================================================
// TEST C — Long gap → hard_reset
// ============================================================================

function testLongGapForcesHardReset() {
  resetAndCleanup();

  const snapshot = makeSnapshot({
    chatId: 300,
    storedAtMs: BASE_TIME,
    responseStyle: "warm",
    presenceMode: "continuing",
    cadenceMode: "warm_compact",
  });
  rememberVoiceContinuity(snapshot);

  const decision = decideVoiceContinuity({
    chatId: 300,
    nowMs: BASE_TIME + 30 * 60 * 1000, // 30 minutes — beyond soft reset window
    nextPresenceMode: "continuing",
    nextResponseStyle: "warm",
    isFollowUp: true,
  });

  if (decision.carryMode !== "hard_reset") {
    throw new Error(`Expected hard_reset for long gap, got ${decision.carryMode}`);
  }
  if (!decision.shouldResetToNeutral) {
    throw new Error("shouldResetToNeutral should be true for long gap");
  }
  if (!decision.warnings.includes("continuity_window_expired")) {
    throw new Error("Missing continuity_window_expired warning");
  }

  console.log("✅ testLongGapForcesHardReset passed");
}

// ============================================================================
// TEST D — Medium gap → soft_reset
// ============================================================================

function testMediumGapProducesSoftReset() {
  resetAndCleanup();

  const snapshot = makeSnapshot({
    chatId: 400,
    storedAtMs: BASE_TIME,
    responseStyle: "supportive",
    presenceMode: "soft_followup",
    cadenceMode: "supportive_gentle",
  });
  rememberVoiceContinuity(snapshot);

  const decision = decideVoiceContinuity({
    chatId: 400,
    nowMs: BASE_TIME + 15 * 60 * 1000, // 15 minutes — beyond recent but within soft window
    nextPresenceMode: "continuing",
    nextResponseStyle: "neutral",
    isFollowUp: true,
  });

  if (decision.carryMode !== "soft_reset") {
    throw new Error(`Expected soft_reset for medium gap, got ${decision.carryMode}`);
  }
  if (decision.shouldInheritStyle || decision.shouldInheritSupportiveTone) {
    throw new Error("Style and supportive tone should NOT be inherited in soft_reset zone");
  }
  if (!decision.warnings.includes("continuity_window_expired")) {
    throw new Error("Missing continuity_window_expired warning");
  }

  console.log("✅ testMediumGapProducesSoftReset passed");
}

// ============================================================================
// TEST E — Supportive snapshot becomes stale → no indefinite supportive carry
// ============================================================================

function testSupportiveSnapshotBecomesStale() {
  resetAndCleanup();

  const snapshot = makeSnapshot({
    chatId: 500,
    storedAtMs: BASE_TIME,
    responseStyle: "supportive",
    presenceMode: "soft_followup",
    cadenceMode: "supportive_gentle",
    assemblyMode: "supportive_spoken",
  });
  rememberVoiceContinuity(snapshot);

  // Within recent window — supportive carry allowed
  const recentDecision = decideVoiceContinuity({
    chatId: 500,
    nowMs: BASE_TIME + 2 * 60 * 1000, // 2 minutes
    nextPresenceMode: "continuing",
    nextResponseStyle: "neutral",
    isFollowUp: true,
  });

  if (recentDecision.carryMode !== "inherit_recent") {
    throw new Error(`Expected inherit_recent within window, got ${recentDecision.carryMode}`);
  }
  if (!recentDecision.shouldInheritSupportiveTone) {
    throw new Error("Supportive tone should be inherited within recent window");
  }

  // Beyond recent window — supportive carry blocked
  const staleDecision = decideVoiceContinuity({
    chatId: 500,
    nowMs: BASE_TIME + 20 * 60 * 1000, // 20 minutes
    nextPresenceMode: "continuing",
    nextResponseStyle: "neutral",
    isFollowUp: true,
  });

  if (staleDecision.carryMode !== "soft_reset") {
    throw new Error(`Expected soft_reset for stale supportive, got ${staleDecision.carryMode}`);
  }
  if (staleDecision.shouldInheritSupportiveTone) {
    throw new Error("Supportive tone should NOT be inherited when stale");
  }
  if (!staleDecision.warnings.includes("supportive_carry_blocked_as_stale")) {
    throw new Error("Missing supportive_carry_blocked_as_stale warning");
  }

  console.log("✅ testSupportiveSnapshotBecomesStale passed");
}

// ============================================================================
// TEST F — Different chats are isolated
// ============================================================================

function testDifferentChatsIsolated() {
  resetAndCleanup();

  const snapshot1 = makeSnapshot({
    chatId: "chat_A",
    storedAtMs: BASE_TIME,
    responseStyle: "warm",
    presenceMode: "continuing",
  });
  const snapshot2 = makeSnapshot({
    chatId: "chat_B",
    storedAtMs: BASE_TIME,
    responseStyle: "concise",
    presenceMode: "fresh",
  });

  rememberVoiceContinuity(snapshot1);
  rememberVoiceContinuity(snapshot2);

  if (getVoiceContinuityMapSize() !== 2) {
    throw new Error(`Expected 2 entries, got ${getVoiceContinuityMapSize()}`);
  }

  // Chat A should have warm style
  const decisionA = decideVoiceContinuity({
    chatId: "chat_A",
    nowMs: BASE_TIME + 60_000,
    nextPresenceMode: "continuing",
    isFollowUp: true,
  });

  if (!decisionA.shouldInheritWarmth) {
    throw new Error("Chat A should inherit warmth");
  }

  // Chat B should have concise style
  const decisionB = decideVoiceContinuity({
    chatId: "chat_B",
    nowMs: BASE_TIME + 60_000,
    nextPresenceMode: "continuing",
    isFollowUp: true,
  });

  if (decisionB.shouldInheritWarmth) {
    throw new Error("Chat B should NOT inherit warmth (was concise)");
  }
  if (!decisionB.hints.includes("directness_carry_allowed_for_followup")) {
    throw new Error("Chat B should have directness carry hint");
  }

  // Chat C (unknown) should have no snapshot
  const decisionC = decideVoiceContinuity({
    chatId: "chat_C",
    nowMs: BASE_TIME + 60_000,
    nextPresenceMode: "continuing",
    isFollowUp: true,
  });

  if (decisionC.carryMode !== "hard_reset") {
    throw new Error(`Chat C should have hard_reset (no snapshot), got ${decisionC.carryMode}`);
  }

  console.log("✅ testDifferentChatsIsolated passed");
}

// ============================================================================
// TEST G — Store → fetch → decide works deterministically
// ============================================================================

function testStoreFetchDecideDeterministic() {
  resetAndCleanup();

  const snapshot = makeSnapshot({
    chatId: 700,
    storedAtMs: BASE_TIME,
    responseStyle: "concise",
    presenceMode: "fresh",
    cadenceMode: "crisp_direct",
    assemblyMode: "direct_spoken",
    smoothingEntryMode: "clean_direct_entry",
    smoothingExitMode: "clean_stop",
  });
  rememberVoiceContinuity(snapshot);

  // Fetch should return exact snapshot
  const fetched = getRecentVoiceContinuity(700);
  if (!fetched) {
    throw new Error("Snapshot should exist");
  }
  if (fetched.chatId !== 700) throw new Error("chatId mismatch");
  if (fetched.responseStyle !== "concise") throw new Error("responseStyle mismatch");
  if (fetched.cadenceMode !== "crisp_direct") throw new Error("cadenceMode mismatch");
  if (fetched.assemblyMode !== "direct_spoken") throw new Error("assemblyMode mismatch");

  // Decision should be deterministic
  const decision1 = decideVoiceContinuity({
    chatId: 700,
    nowMs: BASE_TIME + 60_000,
    nextPresenceMode: "continuing",
    nextResponseStyle: "concise",
    isFollowUp: true,
  });

  const decision2 = decideVoiceContinuity({
    chatId: 700,
    nowMs: BASE_TIME + 60_000,
    nextPresenceMode: "continuing",
    nextResponseStyle: "concise",
    isFollowUp: true,
  });

  if (JSON.stringify(decision1) !== JSON.stringify(decision2)) {
    throw new Error("Decision should be deterministic");
  }

  console.log("✅ testStoreFetchDecideDeterministic passed");
}

// ============================================================================
// TEST H — Current turn can override previous feel without breaking logic
// ============================================================================

function testCurrentTurnOverridesPreviousFeel() {
  resetAndCleanup();

  // Previous turn was warm + supportive
  const snapshot = makeSnapshot({
    chatId: 800,
    storedAtMs: BASE_TIME,
    responseStyle: "supportive",
    presenceMode: "soft_followup",
    cadenceMode: "supportive_gentle",
  });
  rememberVoiceContinuity(snapshot);

  // Current turn wants to be concise/direct — continuity should NOT force old style
  const decision = decideVoiceContinuity({
    chatId: 800,
    nowMs: BASE_TIME + 60_000,
    nextPresenceMode: "continuing", // continuing to trigger full inheritance
    nextResponseStyle: "concise",
    isFollowUp: true, // follow-up to trigger full path
  });

  // Continuity should suggest inheritance, but NOT force it
  if (decision.carryMode !== "inherit_recent") {
    throw new Error(`Expected inherit_recent, got ${decision.carryMode}`);
  }

  // shouldInheritStyle is true but current turn can still choose different style
  // The decision is advisory — current turn context wins if it strongly differs
  if (!decision.hints.includes("continuity_bias_applied")) {
    throw new Error("Missing continuity_bias_applied hint");
  }

  // Verify that the decision does NOT block current turn's different style
  if (decision.shouldResetToNeutral) {
    throw new Error("shouldResetToNeutral should be false — continuity is advisory only");
  }

  console.log("✅ testCurrentTurnOverridesPreviousFeel passed");
}

// ============================================================================
// TEST I — Clear continuity works
// ============================================================================

function testClearContinuity() {
  resetAndCleanup();

  const snapshot = makeSnapshot({ chatId: 900 });
  rememberVoiceContinuity(snapshot);

  if (getVoiceContinuityMapSize() !== 1) {
    throw new Error("Should have 1 entry");
  }

  clearVoiceContinuity(900);

  if (getVoiceContinuityMapSize() !== 0) {
    throw new Error("Should have 0 entries after clear");
  }

  const decision = decideVoiceContinuity({
    chatId: 900,
    nowMs: BASE_TIME + 60_000,
    nextPresenceMode: "continuing",
    isFollowUp: true,
  });

  if (decision.carryMode !== "hard_reset") {
    throw new Error(`Expected hard_reset after clear, got ${decision.carryMode}`);
  }

  console.log("✅ testClearContinuity passed");
}

// ============================================================================
// TEST J — Replacing snapshot keeps only latest
// ============================================================================

function testReplaceSnapshotKeepsLatest() {
  resetAndCleanup();

  const snapshot1 = makeSnapshot({
    chatId: 1000,
    storedAtMs: BASE_TIME,
    responseStyle: "warm",
  });
  rememberVoiceContinuity(snapshot1);

  const snapshot2 = makeSnapshot({
    chatId: 1000,
    storedAtMs: BASE_TIME + 100_000,
    responseStyle: "concise",
  });
  rememberVoiceContinuity(snapshot2);

  if (getVoiceContinuityMapSize() !== 1) {
    throw new Error("Should have only 1 entry after replacement");
  }

  const fetched = getRecentVoiceContinuity(1000);
  if (!fetched) throw new Error("Snapshot should exist");
  if (fetched.responseStyle !== "concise") {
    throw new Error(`Should keep latest snapshot (concise), got ${fetched.responseStyle}`);
  }
  if (fetched.storedAtMs !== BASE_TIME + 100_000) {
    throw new Error("Should keep latest storedAtMs");
  }

  console.log("✅ testReplaceSnapshotKeepsLatest passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Continuity Memory Tests ===\n");

try {
  testRecentFollowUpInheritRecent();
  testResetPresenceForcesHardReset();
  testLongGapForcesHardReset();
  testMediumGapProducesSoftReset();
  testSupportiveSnapshotBecomesStale();
  testDifferentChatsIsolated();
  testStoreFetchDecideDeterministic();
  testCurrentTurnOverridesPreviousFeel();
  testClearContinuity();
  testReplaceSnapshotKeepsLatest();

  console.log("\n✅ All voice continuity memory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
