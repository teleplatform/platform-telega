import {
  generateVoiceChangeProposal,
  formatVoiceChangeProposal,
  type GenerateVoiceChangeProposalInput,
  type VoiceChangeProposal,
} from "../../../src/telegram/voiceGovernedChangeProposal.js";
import {
  evaluateVoiceProposalAdmission,
  formatVoiceProposalAdmissionResult,
  type EvaluateVoiceProposalAdmissionInput,
  type VoiceProposalAdmissionResult,
} from "../../../src/telegram/voiceProposalAdmissionGate.js";
import {
  createVoiceReviewTask,
  transitionVoiceReviewTask,
  orderVoiceReviewQueue,
  formatVoiceReviewTask,
  formatVoiceReviewDecision,
  REVIEW_DEADLINE_MS,
  type CreateVoiceReviewTaskInput,
  type VoiceReviewTask,
} from "../../../src/telegram/voiceReviewQueueOrchestration.js";

// ============================================================================
// helpers
// ============================================================================

function makeProposalInput(
  overrides: Partial<GenerateVoiceChangeProposalInput>,
): GenerateVoiceChangeProposalInput {
  return {
    traceId: overrides.traceId ?? "trace_test",
    source: overrides.source ?? "consistency_guard",
    triggerRef: overrides.triggerRef ?? "conflict_1",
    proposalType: overrides.proposalType ?? "policy_adjustment",
    description: overrides.description ?? "Adjust policy due to conflict.",
    suggestedChange: overrides.suggestedChange ?? {
      target: "cooling_threshold",
      currentValue: 30_000,
      proposedValue: 60_000,
    },
  };
}

function makeProposal(
  overrides: Partial<VoiceChangeProposal> = {},
): VoiceChangeProposal {
  const base = makeProposalInput({});
  return generateVoiceChangeProposal({
    traceId: overrides.traceId ?? base.traceId,
    source: overrides.source ?? base.source,
    triggerRef: overrides.triggerRef ?? base.triggerRef,
    proposalType: overrides.proposalType ?? base.proposalType,
    description: overrides.description ?? base.description,
    suggestedChange: overrides.suggestedChange ?? base.suggestedChange,
  });
}

function makeAdmissionInput(
  proposal: VoiceChangeProposal,
  overrides: Partial<EvaluateVoiceProposalAdmissionInput> = {},
): EvaluateVoiceProposalAdmissionInput {
  return {
    proposal,
    recentProposalIds: overrides.recentProposalIds ?? [],
    proposalRatePerMinute: overrides.proposalRatePerMinute,
    evidenceLinked: overrides.evidenceLinked ?? true,
  };
}

function makeAdmittedResult(proposal: VoiceChangeProposal): VoiceProposalAdmissionResult {
  return {
    proposalId: proposal.proposalId,
    traceId: proposal.traceId,
    admissionStatus: "admitted",
    reasons: [],
    normalizedPriority: "medium",
    reviewMode: "standard",
    admittedAt: Date.now(),
  };
}

// ============================================================================
// V4.3 TESTS
// ============================================================================

function testGeneratesProposalFromConsistencyGuard() {
  const input = makeProposalInput({
    source: "consistency_guard",
    triggerRef: "state_conflict_1",
    proposalType: "policy_adjustment",
  });

  const proposal = generateVoiceChangeProposal(input);

  if (!proposal.proposalId.startsWith("voice_proposal_")) {
    throw new Error("Proposal ID should start with voice_proposal_");
  }
  if (proposal.source !== "consistency_guard") {
    throw new Error(`Expected consistency_guard source, got ${proposal.source}`);
  }
  if (proposal.proposalType !== "policy_adjustment") {
    throw new Error(`Expected policy_adjustment type, got ${proposal.proposalType}`);
  }

  console.log("✅ testGeneratesProposalFromConsistencyGuard passed");
}

function testHighRiskForExecutionFailure() {
  const input = makeProposalInput({
    source: "execution_failure",
    proposalType: "reaction_strategy_change",
  });

  const proposal = generateVoiceChangeProposal(input);

  if (proposal.riskLevel !== "high") {
    throw new Error(`Expected high risk for execution failure, got ${proposal.riskLevel}`);
  }
  if (proposal.requiresHumanReview !== true) {
    throw new Error("Execution failure should require human review");
  }

  console.log("✅ testHighRiskForExecutionFailure passed");
}

function testFormatsProposalCorrectly() {
  const proposal = makeProposal({});
  const formatted = formatVoiceChangeProposal(proposal);

  if (!formatted.includes("📝 Voice Change Proposal")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("proposal ID:")) {
    throw new Error("Missing proposal ID in formatted output");
  }

  console.log("✅ testFormatsProposalCorrectly passed");
}

// ============================================================================
// V4.4 TESTS
// ============================================================================

function testRejectsProposalWithoutEvidence() {
  const proposal = makeProposal({});
  const input = makeAdmissionInput(proposal, { evidenceLinked: false });

  const result = evaluateVoiceProposalAdmission(input);

  if (result.admissionStatus !== "rejected") {
    throw new Error(`Expected rejected, got ${result.admissionStatus}`);
  }
  if (!result.reasons.some(r => r.code === "missing_evidence")) {
    throw new Error("Should have missing_evidence reason");
  }
  if (result.reviewMode !== "blocked") {
    throw new Error(`Expected blocked review mode, got ${result.reviewMode}`);
  }

  console.log("✅ testRejectsProposalWithoutEvidence passed");
}

function testRejectsDuplicateProposal() {
  const proposal = makeProposal({});
  const input = makeAdmissionInput(proposal, {
    evidenceLinked: true,
    recentProposalIds: [proposal.proposalId],
  });

  const result = evaluateVoiceProposalAdmission(input);

  if (result.admissionStatus !== "rejected") {
    throw new Error(`Expected rejected for duplicate, got ${result.admissionStatus}`);
  }
  if (!result.reasons.some(r => r.code === "duplicate_proposal")) {
    throw new Error("Should have duplicate_proposal reason");
  }

  console.log("✅ testRejectsDuplicateProposal passed");
}

function testEscalatesForbiddenScope() {
  const proposal = makeProposal({
    suggestedChange: {
      target: "disable_consistency_guard",
      proposedValue: false,
    },
  });
  const input = makeAdmissionInput(proposal, { evidenceLinked: true });

  const result = evaluateVoiceProposalAdmission(input);

  if (result.admissionStatus !== "escalated") {
    throw new Error(`Expected escalated for forbidden scope, got ${result.admissionStatus}`);
  }
  if (!result.reasons.some(r => r.code === "policy_forbidden")) {
    throw new Error("Should have policy_forbidden reason");
  }
  if (result.reviewMode !== "creator_only") {
    throw new Error(`Expected creator_only review mode, got ${result.reviewMode}`);
  }

  console.log("✅ testEscalatesForbiddenScope passed");
}

function testAdmitsSafeProposal() {
  const proposal = makeProposal({
    source: "performance_signal",
    proposalType: "threshold_tuning",
  });
  const input = makeAdmissionInput(proposal, { evidenceLinked: true });

  const result = evaluateVoiceProposalAdmission(input);

  if (result.admissionStatus !== "admitted") {
    throw new Error(`Expected admitted, got ${result.admissionStatus}`);
  }
  if (result.reviewMode !== "standard") {
    throw new Error(`Expected standard review mode, got ${result.reviewMode}`);
  }

  console.log("✅ testAdmitsSafeProposal passed");
}

function testFormatsAdmissionResultCorrectly() {
  const proposal = makeProposal({});
  const input = makeAdmissionInput(proposal, { evidenceLinked: false });

  const result = evaluateVoiceProposalAdmission(input);
  const formatted = formatVoiceProposalAdmissionResult(result);

  if (!formatted.includes("🔍 Voice Proposal Admission Gate")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("status:")) {
    throw new Error("Missing status in formatted output");
  }

  console.log("✅ testFormatsAdmissionResultCorrectly passed");
}

// ============================================================================
// V4.5 TESTS
// ============================================================================

function testCreatesReviewTaskForAdmittedProposal() {
  const proposal = makeProposal({});
  const admissionResult = makeAdmittedResult(proposal);
  const input: CreateVoiceReviewTaskInput = { admissionResult };

  const task = createVoiceReviewTask(input);

  if (!task) {
    throw new Error("Should create review task for admitted proposal");
  }
  if (!task.taskId.startsWith("voice_review_")) {
    throw new Error("Task ID should start with voice_review_");
  }
  if (task.assignedTo !== "human_operator") {
    throw new Error(`Expected human_operator assignee, got ${task.assignedTo}`);
  }
  if (task.status !== "pending") {
    throw new Error(`Expected pending status, got ${task.status}`);
  }
  if (task.deadlineAt <= Date.now()) {
    throw new Error("Deadline should be in the future");
  }

  console.log("✅ testCreatesReviewTaskForAdmittedProposal passed");
}

function testNoTaskForBlockedReviewMode() {
  const proposal = makeProposal({});
  const admissionResult: VoiceProposalAdmissionResult = {
    proposalId: proposal.proposalId,
    traceId: proposal.traceId,
    admissionStatus: "rejected",
    reasons: [],
    normalizedPriority: "low",
    reviewMode: "blocked",
    admittedAt: Date.now(),
  };

  const task = createVoiceReviewTask({ admissionResult });

  if (task !== null) {
    throw new Error("Should not create task for blocked review mode");
  }

  console.log("✅ testNoTaskForBlockedReviewMode passed");
}

function testPriorityOrdering() {
  const proposal = makeProposal({});
  const base = makeAdmittedResult(proposal);

  const tasks: VoiceReviewTask[] = [
    { ...createVoiceReviewTask({ admissionResult: { ...base, normalizedPriority: "low" } })!, taskId: "t1" },
    { ...createVoiceReviewTask({ admissionResult: { ...base, normalizedPriority: "critical" } })!, taskId: "t2" },
    { ...createVoiceReviewTask({ admissionResult: { ...base, normalizedPriority: "medium" } })!, taskId: "t3" },
    { ...createVoiceReviewTask({ admissionResult: { ...base, normalizedPriority: "high" } })!, taskId: "t4" },
  ];

  const ordered = orderVoiceReviewQueue(tasks, "priority_first");

  if (ordered[0].priority !== "critical") {
    throw new Error("First task should be critical priority");
  }
  if (ordered[3].priority !== "low") {
    throw new Error("Last task should be low priority");
  }

  console.log("✅ testPriorityOrdering passed");
}

function testDeadlineOrdering() {
  const proposal = makeProposal({});
  const base = makeAdmittedResult(proposal);
  const now = Date.now();

  const tasks: VoiceReviewTask[] = [
    { ...createVoiceReviewTask({ admissionResult: { ...base, normalizedPriority: "low" } })!, taskId: "t1", deadlineAt: now + 100000 },
    { ...createVoiceReviewTask({ admissionResult: { ...base, normalizedPriority: "high" } })!, taskId: "t2", deadlineAt: now + 10000 },
    { ...createVoiceReviewTask({ admissionResult: { ...base, normalizedPriority: "medium" } })!, taskId: "t3", deadlineAt: now + 50000 },
  ];

  const ordered = orderVoiceReviewQueue(tasks, "deadline_first");

  if (ordered[0].taskId !== "t2") {
    throw new Error("First task should have earliest deadline");
  }

  console.log("✅ testDeadlineOrdering passed");
}

function testTaskStateTransitions() {
  const proposal = makeProposal({});
  const admissionResult = makeAdmittedResult(proposal);
  const task = createVoiceReviewTask({ admissionResult });

  if (!task) throw new Error("Task should exist");

  const acknowledged = transitionVoiceReviewTask(task, "acknowledged");
  if (acknowledged.status !== "acknowledged") {
    throw new Error("Should transition to acknowledged");
  }

  const inReview = transitionVoiceReviewTask(acknowledged, "in_review");
  if (inReview.status !== "in_review") {
    throw new Error("Should transition to in_review");
  }

  const resolved = transitionVoiceReviewTask(inReview, "resolved");
  if (resolved.status !== "resolved") {
    throw new Error("Should transition to resolved");
  }

  console.log("✅ testTaskStateTransitions passed");
}

function testFormatsReviewTaskCorrectly() {
  const proposal = makeProposal({});
  const admissionResult = makeAdmittedResult(proposal);
  const task = createVoiceReviewTask({ admissionResult });

  if (!task) throw new Error("Task should exist");

  const formatted = formatVoiceReviewTask(task);

  if (!formatted.includes("📋 Voice Review Task")) {
    throw new Error("Missing header in formatted output");
  }
  if (!formatted.includes("assigned to:")) {
    throw new Error("Missing assignee in formatted output");
  }
  if (!formatted.includes("deadline:")) {
    throw new Error("Missing deadline in formatted output");
  }

  console.log("✅ testFormatsReviewTaskCorrectly passed");
}

// ============================================================================
// Run all tests
// ============================================================================

console.log("\n=== V4.3–V4.5: Change Proposal → Admission → Review Tests ===\n");

try {
  // V4.3
  testGeneratesProposalFromConsistencyGuard();
  testHighRiskForExecutionFailure();
  testFormatsProposalCorrectly();

  // V4.4
  testRejectsProposalWithoutEvidence();
  testRejectsDuplicateProposal();
  testEscalatesForbiddenScope();
  testAdmitsSafeProposal();
  testFormatsAdmissionResultCorrectly();

  // V4.5
  testCreatesReviewTaskForAdmittedProposal();
  testNoTaskForBlockedReviewMode();
  testPriorityOrdering();
  testDeadlineOrdering();
  testTaskStateTransitions();
  testFormatsReviewTaskCorrectly();

  console.log("\n✅ All V4.3–V4.5 tests passed\n");
} catch (e: any) {
  console.error(`\n❌ Test failed: ${e?.message ?? String(e)}`);
  process.exit(1);
}
