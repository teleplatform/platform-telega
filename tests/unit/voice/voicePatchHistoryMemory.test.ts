import {
  rememberVoicePatchHistory,
  getRecentVoicePatchHistory,
  getVoicePatchHistorySummary,
  getVoicePatchHistoryCount,
  resetVoicePatchHistory,
  formatVoicePatchHistorySummary,
  type VoicePatchHistoryEntry,
} from "../../../src/telegram/voicePatchHistoryMemory.js";

// ============================================================================
// Helpers
// ============================================================================

const sampleMetrics = {
  voiceSuccessRate: 85,
  fallbackRate: 8,
  interruptionBlockRate: 5,
  avgQualityScore: 75,
};

function makeEntry(overrides: Partial<VoicePatchHistoryEntry>): VoicePatchHistoryEntry {
  return {
    patchId: overrides.patchId ?? "patch_fast_preference",
    rollbackId: overrides.rollbackId,
    recommendationType: overrides.recommendationType ?? "prefer_fast_voice_for_short_replies",
    outcome: overrides.outcome ?? "confirmed",
    reason: overrides.reason ?? "patch_improved_runtime",
    confidence: overrides.confidence ?? "high",
    appliedAtMs: overrides.appliedAtMs ?? Date.now() - 60000,
    finalizedAtMs: overrides.finalizedAtMs ?? Date.now(),
    beforeMetrics: overrides.beforeMetrics ?? sampleMetrics,
    afterMetrics: overrides.afterMetrics ?? sampleMetrics,
  };
}

// ============================================================================
// TEST 1 — records_confirmed_patch_history_entry
// ============================================================================

function testRecordsConfirmedPatchHistoryEntry() {
  resetVoicePatchHistory();

  rememberVoicePatchHistory(makeEntry({
    outcome: "confirmed",
    recommendationType: "prefer_fast_voice_for_short_replies",
  }));

  if (getVoicePatchHistoryCount() !== 1) {
    throw new Error(`Expected 1 entry, got ${getVoicePatchHistoryCount()}`);
  }

  const history = getRecentVoicePatchHistory();
  if (history[0].outcome !== "confirmed") {
    throw new Error(`Expected confirmed outcome, got ${history[0].outcome}`);
  }

  console.log("✅ testRecordsConfirmedPatchHistoryEntry passed");
}

// ============================================================================
// TEST 2 — records_rolled_back_patch_history_entry
// ============================================================================

function testRecordsRolledBackPatchHistoryEntry() {
  resetVoicePatchHistory();

  rememberVoicePatchHistory(makeEntry({
    outcome: "rolled_back",
    patchId: "patch_lower_interrupt",
    rollbackId: "rollback_123",
    reason: "patch_caused_regression",
  }));

  const history = getRecentVoicePatchHistory();
  if (history[0].outcome !== "rolled_back") {
    throw new Error(`Expected rolled_back outcome, got ${history[0].outcome}`);
  }
  if (history[0].rollbackId !== "rollback_123") {
    throw new Error(`Expected rollback_123, got ${history[0].rollbackId}`);
  }

  console.log("✅ testRecordsRolledBackPatchHistoryEntry passed");
}

// ============================================================================
// TEST 3 — records_inconclusive_patch_history_entry
// ============================================================================

function testRecordsInconclusivePatchHistoryEntry() {
  resetVoicePatchHistory();

  rememberVoicePatchHistory(makeEntry({
    outcome: "inconclusive",
    recommendationType: "lower_interruption_guard_sensitivity",
    reason: "mixed_post_apply_signals",
  }));

  const history = getRecentVoicePatchHistory();
  if (history[0].outcome !== "inconclusive") {
    throw new Error(`Expected inconclusive outcome, got ${history[0].outcome}`);
  }

  console.log("✅ testRecordsInconclusivePatchHistoryEntry passed");
}

// ============================================================================
// TEST 4 — bounded_memory_evicts_oldest_entries
// ============================================================================

function testBoundedMemoryEvictsOldestEntries() {
  resetVoicePatchHistory();

  // Add 110 entries
  for (let i = 0; i < 110; i++) {
    rememberVoicePatchHistory(makeEntry({
      patchId: `patch-${i}`,
    }));
  }

  if (getVoicePatchHistoryCount() !== 100) {
    throw new Error(`Expected 100 entries (bounded), got ${getVoicePatchHistoryCount()}`);
  }

  // Oldest entries should be evicted — check that patch-0 is not in history
  const history = getRecentVoicePatchHistory(110);
  const oldestPatchId = history[history.length - 1].patchId;
  if (oldestPatchId === "patch-0") {
    throw new Error("Oldest entry should have been evicted");
  }

  console.log("✅ testBoundedMemoryEvictsOldestEntries passed");
}

// ============================================================================
// TEST 5 — returns_recent_patch_history
// ============================================================================

function testReturnsRecentPatchHistory() {
  resetVoicePatchHistory();

  for (let i = 0; i < 10; i++) {
    rememberVoicePatchHistory(makeEntry({ patchId: `patch-${i}` }));
  }

  const last3 = getRecentVoicePatchHistory(3);
  if (last3.length !== 3) {
    throw new Error(`Expected 3 recent entries, got ${last3.length}`);
  }

  // Most recent first
  if (last3[0].patchId !== "patch-9") {
    throw new Error(`Expected patch-9 as most recent, got ${last3[0].patchId}`);
  }
  if (last3[2].patchId !== "patch-7") {
    throw new Error(`Expected patch-7 as 3rd most recent, got ${last3[2].patchId}`);
  }

  console.log("✅ testReturnsRecentPatchHistory passed");
}

// ============================================================================
// TEST 6 — computes_confirmation_and_rollback_rates
// ============================================================================

function testComputesConfirmationAndRollbackRates() {
  resetVoicePatchHistory();

  // 5 confirmed, 3 rolled_back, 2 inconclusive = 10 total
  for (let i = 0; i < 5; i++) {
    rememberVoicePatchHistory(makeEntry({ outcome: "confirmed", patchId: `confirmed-${i}` }));
  }
  for (let i = 0; i < 3; i++) {
    rememberVoicePatchHistory(makeEntry({ outcome: "rolled_back", patchId: `rollback-${i}` }));
  }
  for (let i = 0; i < 2; i++) {
    rememberVoicePatchHistory(makeEntry({ outcome: "inconclusive", patchId: `inconclusive-${i}` }));
  }

  const summary = getVoicePatchHistorySummary();

  if (summary.confirmedCount !== 5) {
    throw new Error(`Expected 5 confirmed, got ${summary.confirmedCount}`);
  }
  if (summary.rolledBackCount !== 3) {
    throw new Error(`Expected 3 rolled_back, got ${summary.rolledBackCount}`);
  }
  if (summary.inconclusiveCount !== 2) {
    throw new Error(`Expected 2 inconclusive, got ${summary.inconclusiveCount}`);
  }

  // Rates: 50%, 30%, 20%
  if (summary.confirmationRate !== 50) {
    throw new Error(`Expected 50% confirmation rate, got ${summary.confirmationRate}%`);
  }
  if (summary.rollbackRate !== 30) {
    throw new Error(`Expected 30% rollback rate, got ${summary.rollbackRate}%`);
  }
  if (summary.inconclusiveRate !== 20) {
    throw new Error(`Expected 20% inconclusive rate, got ${summary.inconclusiveRate}%`);
  }

  console.log("✅ testComputesConfirmationAndRollbackRates passed");
}

// ============================================================================
// TEST 7 — identifies_most_reliable_patch_types
// ============================================================================

function testIdentifiesMostReliablePatchTypes() {
  resetVoicePatchHistory();

  // prefer_fast_voice_for_short_replies: 4 confirmed, 1 rolled_back → reliable
  for (let i = 0; i < 4; i++) {
    rememberVoicePatchHistory(makeEntry({
      outcome: "confirmed",
      recommendationType: "prefer_fast_voice_for_short_replies",
      patchId: `fast-ok-${i}`,
    }));
  }
  rememberVoicePatchHistory(makeEntry({
    outcome: "rolled_back",
    recommendationType: "prefer_fast_voice_for_short_replies",
    patchId: "fast-fail-0",
  }));

  // allow_more_voice_when_success_rate_is_high: 3 confirmed, 0 rolled_back → reliable
  for (let i = 0; i < 3; i++) {
    rememberVoicePatchHistory(makeEntry({
      outcome: "confirmed",
      recommendationType: "allow_more_voice_when_success_rate_is_high",
      patchId: `allow-ok-${i}`,
    }));
  }

  const summary = getVoicePatchHistorySummary();

  if (!summary.mostReliablePatchTypes.includes("allow_more_voice_when_success_rate_is_high")) {
    throw new Error(`Missing allow_more_voice in reliable types: ${summary.mostReliablePatchTypes.join(", ")}`);
  }
  if (!summary.mostReliablePatchTypes.includes("prefer_fast_voice_for_short_replies")) {
    throw new Error(`Missing prefer_fast_voice in reliable types: ${summary.mostReliablePatchTypes.join(", ")}`);
  }

  console.log("✅ testIdentifiesMostReliablePatchTypes passed");
}

// ============================================================================
// TEST 8 — identifies_most_risky_patch_types
// ============================================================================

function testIdentifiesMostRiskyPatchTypes() {
  resetVoicePatchHistory();

  // lower_interruption_guard_sensitivity: 1 confirmed, 4 rolled_back → risky
  rememberVoicePatchHistory(makeEntry({
    outcome: "confirmed",
    recommendationType: "lower_interruption_guard_sensitivity",
    patchId: "lower-ok-0",
  }));
  for (let i = 0; i < 4; i++) {
    rememberVoicePatchHistory(makeEntry({
      outcome: "rolled_back",
      recommendationType: "lower_interruption_guard_sensitivity",
      patchId: `lower-fail-${i}`,
    }));
  }

  // raise_interruption_guard_sensitivity: 0 confirmed, 3 rolled_back → risky
  for (let i = 0; i < 3; i++) {
    rememberVoicePatchHistory(makeEntry({
      outcome: "rolled_back",
      recommendationType: "raise_interruption_guard_sensitivity",
      patchId: `raise-fail-${i}`,
    }));
  }

  const summary = getVoicePatchHistorySummary();

  if (!summary.mostRiskyPatchTypes.includes("lower_interruption_guard_sensitivity")) {
    throw new Error(`Missing lower_interrupt in risky types: ${summary.mostRiskyPatchTypes.join(", ")}`);
  }
  if (!summary.mostRiskyPatchTypes.includes("raise_interruption_guard_sensitivity")) {
    throw new Error(`Missing raise_interrupt in risky types: ${summary.mostRiskyPatchTypes.join(", ")}`);
  }

  console.log("✅ testIdentifiesMostRiskyPatchTypes passed");
}

// ============================================================================
// TEST 9 — reset_clears_patch_history
// ============================================================================

function testResetClearsPatchHistory() {
  resetVoicePatchHistory();

  for (let i = 0; i < 5; i++) {
    rememberVoicePatchHistory(makeEntry({ patchId: `pre-reset-${i}` }));
  }

  if (getVoicePatchHistoryCount() !== 5) {
    throw new Error(`Expected 5 entries before reset, got ${getVoicePatchHistoryCount()}`);
  }

  resetVoicePatchHistory();

  if (getVoicePatchHistoryCount() !== 0) {
    throw new Error(`Expected 0 entries after reset, got ${getVoicePatchHistoryCount()}`);
  }

  const summary = getVoicePatchHistorySummary();
  if (summary.totalEntries !== 0) {
    throw new Error(`Expected 0 total entries, got ${summary.totalEntries}`);
  }

  console.log("✅ testResetClearsPatchHistory passed");
}

// ============================================================================
// TEST 10 — returns_deterministic_summary_output
// ============================================================================

function testDeterministicSummaryOutput() {
  resetVoicePatchHistory();

  rememberVoicePatchHistory(makeEntry({ outcome: "confirmed" }));
  rememberVoicePatchHistory(makeEntry({ outcome: "rolled_back" }));
  rememberVoicePatchHistory(makeEntry({ outcome: "confirmed" }));

  const summary1 = getVoicePatchHistorySummary();
  const summary2 = getVoicePatchHistorySummary();

  // Strip generatedAtMs for comparison
  const s1 = { ...summary1, generatedAtMs: 0 };
  const s2 = { ...summary2, generatedAtMs: 0 };

  if (JSON.stringify(s1) !== JSON.stringify(s2)) {
    throw new Error("Summary should be deterministic");
  }

  console.log("✅ testDeterministicSummaryOutput passed");
}

// ============================================================================
// TEST 11 — formatter_outputs_human_readable_summary
// ============================================================================

function testFormatterOutputsHumanReadableSummary() {
  resetVoicePatchHistory();

  for (let i = 0; i < 3; i++) {
    rememberVoicePatchHistory(makeEntry({ outcome: "confirmed", patchId: `ok-${i}` }));
  }
  rememberVoicePatchHistory(makeEntry({ outcome: "rolled_back", patchId: "fail-0" }));

  const summary = getVoicePatchHistorySummary();
  const formatted = formatVoicePatchHistorySummary(summary);

  if (!formatted.includes("🧠 Voice Patch History Summary")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("confirmed: 3")) {
    throw new Error("Missing confirmed count in formatted output");
  }
  if (!formatted.includes("rolled back: 1")) {
    throw new Error("Missing rolled_back count in formatted output");
  }
  if (!formatted.includes("confirmation rate: 75%")) {
    throw new Error("Missing confirmation rate in formatted output");
  }

  console.log("✅ testFormatterOutputsHumanReadableSummary passed");
}

// ============================================================================
// TEST 12 — summary_returns_zero_state_when_empty
// ============================================================================

function testSummaryReturnsZeroStateWhenEmpty() {
  resetVoicePatchHistory();

  const summary = getVoicePatchHistorySummary();

  if (summary.totalEntries !== 0) {
    throw new Error(`Expected 0 entries, got ${summary.totalEntries}`);
  }
  if (summary.confirmedCount !== 0) {
    throw new Error(`Expected 0 confirmed, got ${summary.confirmedCount}`);
  }
  if (summary.rollbackRate !== 0) {
    throw new Error(`Expected 0 rollback rate, got ${summary.rollbackRate}`);
  }
  if (summary.mostReliablePatchTypes.length !== 0) {
    throw new Error(`Expected empty reliable types, got ${summary.mostReliablePatchTypes.join(", ")}`);
  }
  if (summary.mostRiskyPatchTypes.length !== 0) {
    throw new Error(`Expected empty risky types, got ${summary.mostRiskyPatchTypes.join(", ")}`);
  }

  console.log("✅ testSummaryReturnsZeroStateWhenEmpty passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Patch History Memory Tests ===\n");

try {
  testRecordsConfirmedPatchHistoryEntry();
  testRecordsRolledBackPatchHistoryEntry();
  testRecordsInconclusivePatchHistoryEntry();
  testBoundedMemoryEvictsOldestEntries();
  testReturnsRecentPatchHistory();
  testComputesConfirmationAndRollbackRates();
  testIdentifiesMostReliablePatchTypes();
  testIdentifiesMostRiskyPatchTypes();
  testResetClearsPatchHistory();
  testDeterministicSummaryOutput();
  testFormatterOutputsHumanReadableSummary();
  testSummaryReturnsZeroStateWhenEmpty();

  console.log("\n✅ All voice patch history memory tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
