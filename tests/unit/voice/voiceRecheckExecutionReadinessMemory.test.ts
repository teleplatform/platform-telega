import {
  recordVoiceRecheckExecutionDecision,
  getVoiceRecheckExecutionHistory,
  getVoiceRecheckExecutionReadinessSummary,
  clearVoiceRecheckExecutionMemory,
  formatVoiceRecheckExecutionReadinessSummary,
  type VoiceRecheckExecutionReadinessSummary,
} from "../../../src/telegram/voiceRecheckExecutionReadinessMemory.js";

// ============================================================================
// helpers
// ============================================================================

function cleanup() {
  clearVoiceRecheckExecutionMemory();
}

// ============================================================================
// TEST 1 — records_allow_recheck_decision
// ============================================================================

function testRecordsAllowRecheckDecision() {
  cleanup();
  const chatId = "test_chat_allow";

  const entry = recordVoiceRecheckExecutionDecision(chatId, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });

  if (entry.decision !== "allow_recheck") {
    throw new Error(`Expected allow_recheck, got ${entry.decision}`);
  }
  if (entry.reasonClass !== "timing_ok") {
    throw new Error(`Expected timing_ok, got ${entry.reasonClass}`);
  }
  if (entry.hadMeaningfulNewSignals !== true) {
    throw new Error("Expected hadMeaningfulNewSignals to be true");
  }
  if (entry.recoveryActive !== false) {
    throw new Error("Expected recoveryActive to be false");
  }
  if (entry.chatId !== chatId) {
    throw new Error(`Expected chatId ${chatId}, got ${entry.chatId}`);
  }
  if (typeof entry.storedAtMs !== "number" || entry.storedAtMs <= 0) {
    throw new Error("Expected valid storedAtMs timestamp");
  }

  console.log("✅ testRecordsAllowRecheckDecision passed");
}

// ============================================================================
// TEST 2 — records_hold_recheck_decision
// ============================================================================

function testRecordsHoldRecheckDecision() {
  cleanup();
  const chatId = "test_chat_hold";

  const entry = recordVoiceRecheckExecutionDecision(chatId, {
    decision: "hold_recheck",
    reasonClass: "cooldown_active",
    hadMeaningfulNewSignals: false,
    recoveryActive: false,
  });

  if (entry.decision !== "hold_recheck") {
    throw new Error(`Expected hold_recheck, got ${entry.decision}`);
  }
  if (entry.reasonClass !== "cooldown_active") {
    throw new Error(`Expected cooldown_active, got ${entry.reasonClass}`);
  }

  console.log("✅ testRecordsHoldRecheckDecision passed");
}

// ============================================================================
// TEST 3 — records_deny_recheck_decision
// ============================================================================

function testRecordsDenyRecheckDecision() {
  cleanup();
  const chatId = "test_chat_deny";

  const entry = recordVoiceRecheckExecutionDecision(chatId, {
    decision: "deny_recheck",
    reasonClass: "still_blocked",
    hadMeaningfulNewSignals: false,
    recoveryActive: true,
  });

  if (entry.decision !== "deny_recheck") {
    throw new Error(`Expected deny_recheck, got ${entry.decision}`);
  }
  if (entry.reasonClass !== "still_blocked") {
    throw new Error(`Expected still_blocked, got ${entry.reasonClass}`);
  }
  if (entry.recoveryActive !== true) {
    throw new Error("Expected recoveryActive to be true");
  }

  console.log("✅ testRecordsDenyRecheckDecision passed");
}

// ============================================================================
// TEST 4 — returns_history_for_chat
// ============================================================================

function testReturnsHistoryForChat() {
  cleanup();
  const chatId = "test_chat_history";

  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "hold_recheck",
    reasonClass: "cooldown_active",
    hadMeaningfulNewSignals: false,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "deny_recheck",
    reasonClass: "still_blocked",
    hadMeaningfulNewSignals: false,
    recoveryActive: true,
  });

  const history = getVoiceRecheckExecutionHistory(chatId);

  if (history.length !== 3) {
    throw new Error(`Expected 3 history entries, got ${history.length}`);
  }
  if (history[0].decision !== "allow_recheck") {
    throw new Error(`Expected first entry to be allow_recheck, got ${history[0].decision}`);
  }
  if (history[1].decision !== "hold_recheck") {
    throw new Error(`Expected second entry to be hold_recheck, got ${history[1].decision}`);
  }
  if (history[2].decision !== "deny_recheck") {
    throw new Error(`Expected third entry to be deny_recheck, got ${history[2].decision}`);
  }

  console.log("✅ testReturnsHistoryForChat passed");
}

// ============================================================================
// TEST 5 — builds_readiness_summary_correctly
// ============================================================================

function testBuildsReadinessSummaryCorrectly() {
  cleanup();
  const chatId = "test_chat_summary";

  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "hold_recheck",
    reasonClass: "cooldown_active",
    hadMeaningfulNewSignals: false,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });

  const summary = getVoiceRecheckExecutionReadinessSummary(chatId);

  if (summary.totalChecks !== 3) {
    throw new Error(`Expected totalChecks 3, got ${summary.totalChecks}`);
  }
  if (summary.allowCount !== 2) {
    throw new Error(`Expected allowCount 2, got ${summary.allowCount}`);
  }
  if (summary.holdCount !== 1) {
    throw new Error(`Expected holdCount 1, got ${summary.holdCount}`);
  }
  if (summary.denyCount !== 0) {
    throw new Error(`Expected denyCount 0, got ${summary.denyCount}`);
  }
  if (summary.lastDecision !== "allow_recheck") {
    throw new Error(`Expected lastDecision allow_recheck, got ${summary.lastDecision}`);
  }
  if (summary.lastCheckAtMs === null) {
    throw new Error("Expected lastCheckAtMs to be set");
  }
  if (summary.repeatedHoldPattern !== false) {
    throw new Error("Expected repeatedHoldPattern to be false");
  }
  if (summary.repeatedDenyPattern !== false) {
    throw new Error("Expected repeatedDenyPattern to be false");
  }

  console.log("✅ testBuildsReadinessSummaryCorrectly passed");
}

// ============================================================================
// TEST 6 — detects_repeated_hold_pattern
// ============================================================================

function testDetectsRepeatedHoldPattern() {
  cleanup();
  const chatId = "test_chat_repeated_hold";

  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "hold_recheck",
    reasonClass: "cooldown_active",
    hadMeaningfulNewSignals: false,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "hold_recheck",
    reasonClass: "insufficient_delta",
    hadMeaningfulNewSignals: false,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "hold_recheck",
    reasonClass: "cooldown_active",
    hadMeaningfulNewSignals: false,
    recoveryActive: false,
  });

  const summary = getVoiceRecheckExecutionReadinessSummary(chatId);

  if (summary.repeatedHoldPattern !== true) {
    throw new Error("Expected repeatedHoldPattern to be true");
  }

  console.log("✅ testDetectsRepeatedHoldPattern passed");
}

// ============================================================================
// TEST 7 — detects_repeated_deny_pattern
// ============================================================================

function testDetectsRepeatedDenyPattern() {
  cleanup();
  const chatId = "test_chat_repeated_deny";

  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "deny_recheck",
    reasonClass: "still_blocked",
    hadMeaningfulNewSignals: false,
    recoveryActive: true,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "deny_recheck",
    reasonClass: "still_blocked",
    hadMeaningfulNewSignals: false,
    recoveryActive: true,
  });

  const summary = getVoiceRecheckExecutionReadinessSummary(chatId);

  if (summary.repeatedDenyPattern !== true) {
    throw new Error("Expected repeatedDenyPattern to be true");
  }

  console.log("✅ testDetectsRepeatedDenyPattern passed");
}

// ============================================================================
// TEST 8 — clears_memory_for_chat
// ============================================================================

function testClearsMemoryForChat() {
  cleanup();
  const chatId = "test_chat_clear";

  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "hold_recheck",
    reasonClass: "cooldown_active",
    hadMeaningfulNewSignals: false,
    recoveryActive: false,
  });

  const historyBefore = getVoiceRecheckExecutionHistory(chatId);
  if (historyBefore.length !== 2) {
    throw new Error(`Expected 2 history entries before clear, got ${historyBefore.length}`);
  }

  clearVoiceRecheckExecutionMemory(chatId);

  const historyAfter = getVoiceRecheckExecutionHistory(chatId);
  if (historyAfter.length !== 0) {
    throw new Error(`Expected 0 history entries after clear, got ${historyAfter.length}`);
  }

  console.log("✅ testClearsMemoryForChat passed");
}

// ============================================================================
// TEST 9 — returns_deterministic_output
// ============================================================================

function testReturnsDeterministicOutput() {
  cleanup();
  const chatId = "test_chat_deterministic";

  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "hold_recheck",
    reasonClass: "cooldown_active",
    hadMeaningfulNewSignals: false,
    recoveryActive: false,
  });

  const summary1 = getVoiceRecheckExecutionReadinessSummary(chatId);
  const summary2 = getVoiceRecheckExecutionReadinessSummary(chatId);

  // Strip lastCheckAtMs for comparison (timestamp varies)
  const s1 = { ...summary1, lastCheckAtMs: 0 };
  const s2 = { ...summary2, lastCheckAtMs: 0 };

  if (JSON.stringify(s1) !== JSON.stringify(s2)) {
    throw new Error("Summary should be deterministic");
  }

  console.log("✅ testReturnsDeterministicOutput passed");
}

// ============================================================================
// TEST 10 — does_not_cross_contaminate_chats
// ============================================================================

function testDoesNotCrossContaminateChats() {
  cleanup();
  const chatA = "test_chat_a";
  const chatB = "test_chat_b";

  recordVoiceRecheckExecutionDecision(chatA, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });
  recordVoiceRecheckExecutionDecision(chatB, {
    decision: "deny_recheck",
    reasonClass: "still_blocked",
    hadMeaningfulNewSignals: false,
    recoveryActive: true,
  });

  const summaryA = getVoiceRecheckExecutionReadinessSummary(chatA);
  const summaryB = getVoiceRecheckExecutionReadinessSummary(chatB);

  if (summaryA.allowCount !== 1) {
    throw new Error(`Expected chat A allowCount 1, got ${summaryA.allowCount}`);
  }
  if (summaryA.denyCount !== 0) {
    throw new Error(`Expected chat A denyCount 0, got ${summaryA.denyCount}`);
  }
  if (summaryB.allowCount !== 0) {
    throw new Error(`Expected chat B allowCount 0, got ${summaryB.allowCount}`);
  }
  if (summaryB.denyCount !== 1) {
    throw new Error(`Expected chat B denyCount 1, got ${summaryB.denyCount}`);
  }

  console.log("✅ testDoesNotCrossContaminateChats passed");
}

// ============================================================================
// TEST 11 — bounded_history_evicts_oldest_entries
// ============================================================================

function testBoundedHistoryEvictsOldestEntries() {
  cleanup();
  const chatId = "test_chat_bounded";

  // Add 25 entries (exceeding MAX_HISTORY_PER_CHAT = 20)
  for (let i = 0; i < 25; i++) {
    recordVoiceRecheckExecutionDecision(chatId, {
      decision: i % 2 === 0 ? "allow_recheck" : "hold_recheck",
      reasonClass: i % 2 === 0 ? "timing_ok" : "cooldown_active",
      hadMeaningfulNewSignals: i % 2 === 0,
      recoveryActive: false,
    });
  }

  const history = getVoiceRecheckExecutionHistory(chatId);

  if (history.length !== 20) {
    throw new Error(`Expected bounded history of 20, got ${history.length}`);
  }

  // Verify oldest entries were evicted (entries 5-24 should remain)
  // Entry 5 was index 5, which is odd → hold_recheck
  if (history[0].decision !== "hold_recheck") {
    throw new Error(`Expected first entry after eviction to be hold_recheck, got ${history[0].decision}`);
  }

  console.log("✅ testBoundedHistoryEvictsOldestEntries passed");
}

// ============================================================================
// TEST 12 — formatter_outputs_human_readable_summary
// ============================================================================

function testFormatterOutputsHumanReadableSummary() {
  cleanup();
  const chatId = "test_chat_formatter";

  recordVoiceRecheckExecutionDecision(chatId, {
    decision: "allow_recheck",
    reasonClass: "timing_ok",
    hadMeaningfulNewSignals: true,
    recoveryActive: false,
  });

  const summary = getVoiceRecheckExecutionReadinessSummary(chatId);
  const formatted = formatVoiceRecheckExecutionReadinessSummary(summary);

  if (!formatted.includes("🧠 Voice Recheck Readiness Memory")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("total checks:")) {
    throw new Error("Missing total checks in formatted output");
  }
  if (!formatted.includes("allow:")) {
    throw new Error("Missing allow in formatted output");
  }
  if (!formatted.includes("hold:")) {
    throw new Error("Missing hold in formatted output");
  }
  if (!formatted.includes("deny:")) {
    throw new Error("Missing deny in formatted output");
  }
  if (!formatted.includes("last decision:")) {
    throw new Error("Missing last decision in formatted output");
  }
  if (!formatted.includes("last check at:")) {
    throw new Error("Missing last check at in formatted output");
  }
  if (!formatted.includes("repeated hold pattern:")) {
    throw new Error("Missing repeated hold pattern in formatted output");
  }
  if (!formatted.includes("repeated deny pattern:")) {
    throw new Error("Missing repeated deny pattern in formatted output");
  }

  console.log("✅ testFormatterOutputsHumanReadableSummary passed");
}

// ============================================================================
// TEST 13 — empty_history_returns_zero_summary
// ============================================================================

function testEmptyHistoryReturnsZeroSummary() {
  cleanup();
  const chatId = "test_chat_empty";

  const summary = getVoiceRecheckExecutionReadinessSummary(chatId);

  if (summary.totalChecks !== 0) {
    throw new Error(`Expected totalChecks 0, got ${summary.totalChecks}`);
  }
  if (summary.allowCount !== 0) {
    throw new Error(`Expected allowCount 0, got ${summary.allowCount}`);
  }
  if (summary.holdCount !== 0) {
    throw new Error(`Expected holdCount 0, got ${summary.holdCount}`);
  }
  if (summary.denyCount !== 0) {
    throw new Error(`Expected denyCount 0, got ${summary.denyCount}`);
  }
  if (summary.lastDecision !== null) {
    throw new Error(`Expected lastDecision null, got ${summary.lastDecision}`);
  }
  if (summary.lastCheckAtMs !== null) {
    throw new Error(`Expected lastCheckAtMs null, got ${summary.lastCheckAtMs}`);
  }
  if (summary.repeatedHoldPattern !== false) {
    throw new Error("Expected repeatedHoldPattern false");
  }
  if (summary.repeatedDenyPattern !== false) {
    throw new Error("Expected repeatedDenyPattern false");
  }

  console.log("✅ testEmptyHistoryReturnsZeroSummary passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Recheck Execution Readiness Memory Tests ===\n");

try {
  testRecordsAllowRecheckDecision();
  testRecordsHoldRecheckDecision();
  testRecordsDenyRecheckDecision();
  testReturnsHistoryForChat();
  testBuildsReadinessSummaryCorrectly();
  testDetectsRepeatedHoldPattern();
  testDetectsRepeatedDenyPattern();
  testClearsMemoryForChat();
  testReturnsDeterministicOutput();
  testDoesNotCrossContaminateChats();
  testBoundedHistoryEvictsOldestEntries();
  testFormatterOutputsHumanReadableSummary();
  testEmptyHistoryReturnsZeroSummary();

  console.log("\n✅ All voice recheck execution readiness memory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
