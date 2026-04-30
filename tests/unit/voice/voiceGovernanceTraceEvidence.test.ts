import {
  buildVoiceGovernanceTraceEvidence,
  verifyVoiceGovernanceTraceEvidenceChecksum,
  formatVoiceGovernanceTraceEvidence,
  VOICE_GOVERNANCE_SOURCE_LAYERS,
  type VoiceGovernanceTraceEvidence,
  type VoiceGovernanceTraceEvidenceContext,
} from "../../../src/telegram/voiceGovernanceTraceEvidence.js";
import type { VoiceGovernanceTraceExplanation } from "../../../src/telegram/voiceGovernanceTraceExplanation.js";

// ============================================================================
// helpers
// ============================================================================

function makeTrace(
  overrides: Partial<VoiceGovernanceTraceExplanation>,
): VoiceGovernanceTraceExplanation {
  return {
    generatedAtMs: overrides.generatedAtMs ?? Date.now(),
    finalDecisionSummary: overrides.finalDecisionSummary ?? "Loop is stable.",
    explanationSteps: overrides.explanationSteps ?? ["Step 1: stable"],
    keyDrivers: overrides.keyDrivers ?? ["stable loop"],
    riskLevel: overrides.riskLevel ?? "low",
    explanationText: overrides.explanationText ?? "The voice loop is stable.",
  };
}

function makeContext(
  overrides: Partial<VoiceGovernanceTraceEvidenceContext> = {},
): VoiceGovernanceTraceEvidenceContext {
  return {
    traceId: overrides.traceId ?? "test_trace_123",
    sessionId: overrides.sessionId,
    chatId: overrides.chatId,
  };
}

// ============================================================================
// TEST 1 — creates_evidence_with_correct_fields
// ============================================================================

function testCreatesEvidenceWithCorrectFields() {
  const trace = makeTrace({
    finalDecisionSummary: "Loop frozen due to instability.",
    explanationSteps: ["Step 1", "Step 2"],
    keyDrivers: ["instability", "freeze"],
    riskLevel: "high",
    explanationText: "Full explanation here.",
  });
  const context = makeContext({ traceId: "trace_abc", chatId: "chat_456" });

  const evidence = buildVoiceGovernanceTraceEvidence(trace, context);

  if (!evidence.evidenceId.startsWith("voice_trace_")) {
    throw new Error(`Evidence ID should start with voice_trace_, got ${evidence.evidenceId}`);
  }
  if (evidence.traceId !== "trace_abc") {
    throw new Error(`Expected traceId trace_abc, got ${evidence.traceId}`);
  }
  if (evidence.evidenceType !== "voice_governance_trace") {
    throw new Error(`Expected voice_governance_trace type, got ${evidence.evidenceType}`);
  }
  if (evidence.riskLevel !== "high") {
    throw new Error(`Expected high risk, got ${evidence.riskLevel}`);
  }
  if (evidence.chatId !== "chat_456") {
    throw new Error(`Expected chatId chat_456, got ${evidence.chatId}`);
  }
  if (typeof evidence.checksum !== "string" || evidence.checksum.length !== 64) {
    throw new Error(`Expected 64-char SHA-256 checksum, got length ${evidence.checksum.length}`);
  }

  console.log("✅ testCreatesEvidenceWithCorrectFields passed");
}

// ============================================================================
// TEST 2 — source_layers_are_fixed
// ============================================================================

function testSourceLayersAreFixed() {
  const trace = makeTrace({});
  const context = makeContext();

  const evidence = buildVoiceGovernanceTraceEvidence(trace, context);

  if (evidence.sourceLayers.length !== 6) {
    throw new Error(`Expected 6 source layers, got ${evidence.sourceLayers.length}`);
  }
  if (JSON.stringify(evidence.sourceLayers) !== JSON.stringify(VOICE_GOVERNANCE_SOURCE_LAYERS)) {
    throw new Error("Source layers should match fixed constant");
  }

  console.log("✅ testSourceLayersAreFixed passed");
}

// ============================================================================
// TEST 3 — checksum_is_valid_sha256
// ============================================================================

function testChecksumIsValidSha256() {
  const trace = makeTrace({
    finalDecisionSummary: "Test summary",
    explanationSteps: ["step1", "step2"],
    keyDrivers: ["driver1"],
    riskLevel: "medium",
  });
  const context = makeContext();

  const evidence = buildVoiceGovernanceTraceEvidence(trace, context);

  // SHA-256 produces 64 hex characters
  if (evidence.checksum.length !== 64) {
    throw new Error(`Checksum should be 64 chars, got ${evidence.checksum.length}`);
  }
  if (!/^[a-f0-9]{64}$/.test(evidence.checksum)) {
    throw new Error("Checksum should be valid hex string");
  }

  console.log("✅ testChecksumIsValidSha256 passed");
}

// ============================================================================
// TEST 4 — checksum_is_deterministic
// ============================================================================

function testChecksumIsDeterministic() {
  const trace = makeTrace({
    finalDecisionSummary: "Deterministic test",
    explanationSteps: ["step A"],
    keyDrivers: ["driver B"],
    riskLevel: "low",
  });
  const context = makeContext();

  const evidence1 = buildVoiceGovernanceTraceEvidence(trace, context);
  const evidence2 = buildVoiceGovernanceTraceEvidence(trace, context);

  if (evidence1.checksum !== evidence2.checksum) {
    throw new Error("Checksum should be deterministic for same trace content");
  }

  console.log("✅ testChecksumIsDeterministic passed");
}

// ============================================================================
// TEST 5 — checksum_verification_succeeds
// ============================================================================

function testChecksumVerificationSucceeds() {
  const trace = makeTrace({
    finalDecisionSummary: "Verification test",
    keyDrivers: ["test_driver"],
    riskLevel: "medium",
  });
  const context = makeContext();

  const evidence = buildVoiceGovernanceTraceEvidence(trace, context);

  if (!verifyVoiceGovernanceTraceEvidenceChecksum(evidence)) {
    throw new Error("Checksum verification should succeed for unmodified evidence");
  }

  console.log("✅ testChecksumVerificationSucceeds passed");
}

// ============================================================================
// TEST 6 — checksum_verification_fails_on_tamper
// ============================================================================

function testChecksumVerificationFailsOnTamper() {
  const trace = makeTrace({
    finalDecisionSummary: "Tamper test",
    keyDrivers: ["original_driver"],
    riskLevel: "low",
  });
  const context = makeContext();

  const evidence = buildVoiceGovernanceTraceEvidence(trace, context);

  // Tamper with the evidence
  evidence.finalDecisionSummary = "TAMPERED SUMMARY";

  if (verifyVoiceGovernanceTraceEvidenceChecksum(evidence)) {
    throw new Error("Checksum verification should fail on tampered evidence");
  }

  console.log("✅ testChecksumVerificationFailsOnTamper passed");
}

// ============================================================================
// TEST 7 — evidence_id_is_unique
// ============================================================================

function testEvidenceIdIsUnique() {
  const trace = makeTrace({});
  const context = makeContext();

  const evidence1 = buildVoiceGovernanceTraceEvidence(trace, context);
  const evidence2 = buildVoiceGovernanceTraceEvidence(trace, context);

  if (evidence1.evidenceId === evidence2.evidenceId) {
    throw new Error("Evidence IDs should be unique (contain random component)");
  }

  console.log("✅ testEvidenceIdIsUnique passed");
}

// ============================================================================
// TEST 8 — formats_output_correctly
// ============================================================================

function testFormatsOutputCorrectly() {
  const trace = makeTrace({ riskLevel: "high" });
  const context = makeContext({ chatId: "chat_123" });

  const evidence = buildVoiceGovernanceTraceEvidence(trace, context);
  const formatted = formatVoiceGovernanceTraceEvidence(evidence);

  if (!formatted.includes("🔐 Voice Governance Trace Evidence")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("evidence ID:")) {
    throw new Error("Missing evidence ID in formatted output");
  }
  if (!formatted.includes("trace ID:")) {
    throw new Error("Missing trace ID in formatted output");
  }
  if (!formatted.includes("checksum:")) {
    throw new Error("Missing checksum in formatted output");
  }
  if (!formatted.includes("risk level:")) {
    throw new Error("Missing risk level in formatted output");
  }
  if (!formatted.includes("source layers:")) {
    throw new Error("Missing source layers in formatted output");
  }

  console.log("✅ testFormatsOutputCorrectly passed");
}

// ============================================================================
// TEST 9 — does_not_mutate_input
// ============================================================================

function testDoesNotMutateInput() {
  const trace = makeTrace({
    finalDecisionSummary: "Mutation test",
    keyDrivers: ["original_driver"],
    riskLevel: "medium",
  });
  const context = makeContext();

  const originalTrace = JSON.stringify(trace);
  const originalContext = JSON.stringify(context);

  buildVoiceGovernanceTraceEvidence(trace, context);

  if (JSON.stringify(trace) !== originalTrace) {
    throw new Error("Input trace should not be mutated");
  }
  if (JSON.stringify(context) !== originalContext) {
    throw new Error("Input context should not be mutated");
  }

  console.log("✅ testDoesNotMutateInput passed");
}

// ============================================================================
// TEST 10 — handles_optional_context_fields
// ============================================================================

function testHandlesOptionalContextFields() {
  const trace = makeTrace({});
  const contextWithSession = makeContext({
    traceId: "trace_session",
    sessionId: "session_789",
    chatId: "chat_101",
  });

  const evidence = buildVoiceGovernanceTraceEvidence(trace, contextWithSession);

  if (evidence.sessionId !== "session_789") {
    throw new Error(`Expected sessionId session_789, got ${evidence.sessionId}`);
  }
  if (evidence.chatId !== "chat_101") {
    throw new Error(`Expected chatId chat_101, got ${evidence.chatId}`);
  }

  // Test without optional fields
  const contextMinimal = makeContext({ traceId: "trace_minimal" });
  const evidenceMinimal = buildVoiceGovernanceTraceEvidence(trace, contextMinimal);

  if (evidenceMinimal.sessionId !== undefined) {
    throw new Error("Session ID should be undefined when not provided");
  }
  if (evidenceMinimal.chatId !== undefined) {
    throw new Error("Chat ID should be undefined when not provided");
  }

  console.log("✅ testHandlesOptionalContextFields passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== Voice Governance Trace Evidence Tests ===\n");

try {
  testCreatesEvidenceWithCorrectFields();
  testSourceLayersAreFixed();
  testChecksumIsValidSha256();
  testChecksumIsDeterministic();
  testChecksumVerificationSucceeds();
  testChecksumVerificationFailsOnTamper();
  testEvidenceIdIsUnique();
  testFormatsOutputCorrectly();
  testDoesNotMutateInput();
  testHandlesOptionalContextFields();

  console.log("\n✅ All voice governance trace evidence tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
