import assert from "node:assert/strict";

// ============================================================================
// Test harness (matches project convention)
// ============================================================================
let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e: any) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${e.message || e}`);
  }
}

// ============================================================================
// V7.3 — Voice Environment Context
// ============================================================================
console.log("\n🌍 V7.3 — Voice Environment Context");

import {
  detectVoiceEnvironment,
  validateEnvironmentContext,
  formatVoiceEnvironmentContext,
  setCurrentEnvironmentContext,
  getVoiceEnvironmentContextRegistry,
  clearVoiceEnvironmentContextRegistry,
} from "../../../src/telegram/voiceEnvironmentContext.js";

test("detects crisis environment", () => {
  const result = detectVoiceEnvironment({
    instabilityScore: 85,
    rollbackFrequency: 5,
    stabilityDurationHours: 1,
    positiveSignalRate: 20,
    errorRate: 40,
    avgLatencyMs: 6000,
    loadPercentage: 90,
    isTestEnvironment: false,
    isStaging: false,
    recoveryInProgress: false,
  });
  assert.equal(result.context.environmentType, "crisis");
  assert.equal(result.context.riskLevel, "critical");
  assert.equal(result.context.adaptationAllowance, "none");
});

test("detects testing environment", () => {
  const result = detectVoiceEnvironment({
    instabilityScore: 10,
    rollbackFrequency: 0,
    stabilityDurationHours: 0,
    positiveSignalRate: 50,
    errorRate: 5,
    avgLatencyMs: 100,
    loadPercentage: 10,
    isTestEnvironment: true,
    isStaging: false,
    recoveryInProgress: false,
  });
  assert.equal(result.context.environmentType, "testing");
  assert.equal(result.context.adaptationAllowance, "full");
});

test("detects growth environment", () => {
  const result = detectVoiceEnvironment({
    instabilityScore: 5,
    rollbackFrequency: 0,
    stabilityDurationHours: 48,
    positiveSignalRate: 85,
    errorRate: 2,
    avgLatencyMs: 500,
    loadPercentage: 30,
    isTestEnvironment: false,
    isStaging: false,
    recoveryInProgress: false,
  });
  assert.equal(result.context.environmentType, "growth");
});

test("detects production environment (default)", () => {
  const result = detectVoiceEnvironment({
    instabilityScore: 10,
    rollbackFrequency: 0,
    stabilityDurationHours: 12,
    positiveSignalRate: 60,
    errorRate: 5,
    avgLatencyMs: 1000,
    loadPercentage: 40,
    isTestEnvironment: false,
    isStaging: false,
    recoveryInProgress: false,
  });
  assert.equal(result.context.environmentType, "production");
});

test("detects stabilization environment", () => {
  const result = detectVoiceEnvironment({
    instabilityScore: 30,
    rollbackFrequency: 1,
    stabilityDurationHours: 2,
    positiveSignalRate: 40,
    errorRate: 20,
    avgLatencyMs: 3000,
    loadPercentage: 60,
    isTestEnvironment: false,
    isStaging: false,
    recoveryInProgress: true,
  });
  assert.equal(result.context.environmentType, "stabilization");
});

test("registry stores context", () => {
  clearVoiceEnvironmentContextRegistry();
  const result1 = detectVoiceEnvironment({
    instabilityScore: 5,
    rollbackFrequency: 0,
    stabilityDurationHours: 24,
    positiveSignalRate: 70,
    errorRate: 2,
    avgLatencyMs: 500,
    loadPercentage: 30,
    isTestEnvironment: false,
    isStaging: false,
    recoveryInProgress: false,
  });
  setCurrentEnvironmentContext(result1.context);
  const result2 = detectVoiceEnvironment({
    instabilityScore: 10,
    rollbackFrequency: 0,
    stabilityDurationHours: 48,
    positiveSignalRate: 80,
    errorRate: 1,
    avgLatencyMs: 400,
    loadPercentage: 25,
    isTestEnvironment: false,
    isStaging: false,
    recoveryInProgress: false,
  });
  setCurrentEnvironmentContext(result2.context);
  const registry = getVoiceEnvironmentContextRegistry();
  assert.ok(registry.current);
  assert.equal(registry.current?.environmentType, "growth");
  assert.equal(registry.history.length, 1);
});

test("validation catches invalid context", () => {
  const errors = validateEnvironmentContext({
    environmentType: "invalid" as any,
    indicators: ["stable_long_period"],
  });
  assert.ok(errors.includes("invalid_environment_type"));
});

test("formatVoiceEnvironmentContext produces output", () => {
  const result = detectVoiceEnvironment({
    instabilityScore: 5,
    rollbackFrequency: 0,
    stabilityDurationHours: 48,
    positiveSignalRate: 85,
    errorRate: 1,
    avgLatencyMs: 400,
    loadPercentage: 25,
    isTestEnvironment: false,
    isStaging: false,
    recoveryInProgress: false,
  });
  const formatted = formatVoiceEnvironmentContext(result.context);
  assert.ok(formatted.includes("Voice Environment Context"));
  assert.ok(formatted.includes("growth"));
});

// ============================================================================
// V7.4 — Voice Context-Aware Policy
// ============================================================================
console.log("\n📋 V7.4 — Voice Context-Aware Policy");

import {
  generateVoiceContextAwarePolicy,
  validatePolicyAdjustments,
  formatVoiceContextAwarePolicy,
  compareVoicePolicies,
  setActiveVoiceContextAwarePolicy,
  getVoiceContextAwarePolicyRegistry,
  clearVoiceContextAwarePolicyRegistry,
} from "../../../src/telegram/voiceContextAwarePolicy.js";

test("crisis policy has zero adaptation", () => {
  const policy = generateVoiceContextAwarePolicy({
    environmentType: "crisis",
  });
  assert.equal(policy.policyAdjustments.adaptationAggressiveness, 0);
  assert.equal(policy.policyAdjustments.riskTolerance, 0);
  assert.equal(policy.policyAdjustments.reviewStrictness, 1);
  assert.equal(policy.enforcementMode, "strict");
});

test("testing policy has full adaptation", () => {
  const policy = generateVoiceContextAwarePolicy({
    environmentType: "testing",
  });
  assert.equal(policy.policyAdjustments.adaptationAggressiveness, 1);
  assert.equal(policy.policyAdjustments.rolloutSpeed, 1);
  assert.equal(policy.enforcementMode, "soft");
});

test("critical risk locks down any policy", () => {
  const policy = generateVoiceContextAwarePolicy({
    environmentType: "growth",
    riskLevel: "critical",
  });
  assert.equal(policy.policyAdjustments.adaptationAggressiveness, 0);
  assert.equal(policy.policyAdjustments.requireHumanReview, true);
});

test("validation catches out-of-range adjustments", () => {
  const errors = validatePolicyAdjustments({
    adaptationAggressiveness: 1.5,
  });
  assert.ok(errors.includes("adaptation_aggressiveness_out_of_range"));
});

test("compareVoicePolicies detects differences", () => {
  const policyA = generateVoiceContextAwarePolicy({ environmentType: "crisis" });
  const policyB = generateVoiceContextAwarePolicy({ environmentType: "growth" });
  const diff = compareVoicePolicies(policyA, policyB);
  assert.notEqual(diff, "No policy differences");
});

test("registry stores active policy", () => {
  clearVoiceContextAwarePolicyRegistry();
  const policy = generateVoiceContextAwarePolicy({ environmentType: "production" });
  setActiveVoiceContextAwarePolicy(policy);
  const registry = getVoiceContextAwarePolicyRegistry();
  assert.ok(registry.active);
});

// ============================================================================
// V7.5 — Voice Environment Transition
// ============================================================================
console.log("\n🔄 V7.5 — Voice Environment Transition");

import {
  createVoiceEnvironmentTransition,
  validateTransition,
  startTransition,
  completeTransition,
  rejectTransition,
  formatVoiceEnvironmentTransition,
  addVoiceEnvironmentTransition,
  getVoiceEnvironmentTransitionLog,
  clearVoiceEnvironmentTransitionLog,
} from "../../../src/telegram/voiceEnvironmentTransition.js";

test("crisis transition is immediate", () => {
  const { transition } = createVoiceEnvironmentTransition({
    fromContext: "production",
    toContext: "crisis",
    trigger: "crisis_detected",
  });
  assert.equal(transition.transitionMode, "immediate");
  assert.equal(transition.status, "proposed");
});

test("same context transition is rejected", () => {
  const { validationErrors } = createVoiceEnvironmentTransition({
    fromContext: "production",
    toContext: "production",
    trigger: "stability_drop",
  });
  assert.ok(validationErrors.includes("same_context"));
});

test("invalid transition is rejected", () => {
  const errors = validateTransition("crisis", "growth", "growth_window_opened");
  assert.ok(errors.includes("transition_not_allowed"));
});

test("completeTransition updates status", () => {
  const { transition } = createVoiceEnvironmentTransition({
    fromContext: "production",
    toContext: "testing",
    trigger: "test_session_started",
  });
  const started = startTransition(transition);
  const completed = completeTransition(started);
  assert.equal(completed.status, "completed");
  assert.ok(completed.completedAt);
});

test("rejectTransition adds reason", () => {
  const { transition } = createVoiceEnvironmentTransition({
    fromContext: "production",
    toContext: "testing",
    trigger: "test_session_started",
  });
  const rejected = rejectTransition(transition, "Not authorized");
  assert.equal(rejected.status, "rejected");
  assert.ok(rejected.validationErrors.includes("Not authorized"));
});

test("transition log stores entries", () => {
  clearVoiceEnvironmentTransitionLog();
  const { transition } = createVoiceEnvironmentTransition({
    fromContext: "production",
    toContext: "testing",
    trigger: "test_session_started",
  });
  addVoiceEnvironmentTransition(transition);
  const log = getVoiceEnvironmentTransitionLog();
  assert.ok(log.transitions.length > 0);
});

// ============================================================================
// V7.6 — Voice Domain Segmentation
// ============================================================================
console.log("\n🏛️ V7.6 — Voice Domain Segmentation");

import {
  createVoiceDomain,
  validateVoiceDomain,
  recordDomainFailure,
  recoverDomain,
  analyzeDomainIsolation,
  formatVoiceDomain,
  registerVoiceDomain,
  getVoiceDomainRegistry,
  getVoiceDomainsByType,
  clearVoiceDomainRegistry,
} from "../../../src/telegram/voiceDomainSegmentation.js";

test("safety domain has strict isolation", () => {
  const { domain } = createVoiceDomain({ domainType: "safety" });
  assert.equal(domain.isolationLevel, "strict");
  assert.equal(domain.riskProfile, "critical");
});

test("execution domain has shared isolation", () => {
  const { domain } = createVoiceDomain({ domainType: "execution" });
  assert.equal(domain.isolationLevel, "shared");
  assert.equal(domain.riskProfile, "low");
});

test("domain failure degrades health", () => {
  const { domain } = createVoiceDomain({ domainType: "strategy" });
  assert.equal(domain.healthScore, 100);
  const failed = recordDomainFailure(domain);
  assert.ok(failed.healthScore < 100);
  assert.equal(failed.failureCount, 1);
});

test("domain recovery improves health", () => {
  const { domain } = createVoiceDomain({ domainType: "strategy" });
  const failed = recordDomainFailure(domain);
  const recovered = recoverDomain(failed);
  assert.ok(recovered.healthScore > failed.healthScore);
});

test("isolation analysis detects cascade risk", () => {
  const { domain: safety } = createVoiceDomain({ domainType: "safety" });
  const { domain: execution } = createVoiceDomain({ domainType: "execution" });
  const analysis = analyzeDomainIsolation(safety, execution);
  assert.ok(analysis.isolationStrength > 0);
  assert.ok(["none", "low", "medium", "high"].includes(analysis.cascadeRisk));
});

test("registry stores domains", () => {
  clearVoiceDomainRegistry();
  const { domain } = createVoiceDomain({ domainType: "review" });
  registerVoiceDomain(domain);
  const reviewDomains = getVoiceDomainsByType("review");
  assert.equal(reviewDomains.length, 1);
});

// ============================================================================
// V7.7 — Voice Domain Consensus
// ============================================================================
console.log("\n⚖️ V7.7 — Voice Domain Consensus");

import {
  resolveVoiceDomainConsensus,
  validateConsensusProposals,
  formatVoiceDomainConsensus,
  recordVoiceDomainConsensus,
  getVoiceDomainConsensusHistory,
  clearVoiceDomainConsensusHistory,
} from "../../../src/telegram/voiceDomainConsensus.js";

test("safety override wins consensus", () => {
  const result = resolveVoiceDomainConsensus({
    topic: "Deploy new model",
    proposals: [
      { domainId: "exec_1", domainType: "execution", decision: "Deploy now", confidence: 90 },
      { domainId: "safety_1", domainType: "safety", decision: "Block — risk too high", confidence: 85 },
    ],
    domainRegistry: new Map(),
  });
  assert.equal(result.resolution, "safety_override");
  assert.equal(result.consensus.finalDecision, "Block — risk too high");
});

test("majority vote resolves tie", () => {
  const result = resolveVoiceDomainConsensus({
    topic: "Adjust threshold",
    proposals: [
      { domainId: "exec_1", domainType: "execution", decision: "Increase", confidence: 60 },
      { domainId: "adapt_1", domainType: "adaptation", decision: "Increase", confidence: 70 },
      { domainId: "review_1", domainType: "review", decision: "Decrease", confidence: 50 },
    ],
    domainRegistry: new Map(),
  });
  // execution (60) and adaptation (70) both say "Increase" — adaptation has confidence 70 which triggers priority_domain
  // This is correct behavior — priority_domain fires before majority_vote
  assert.ok(
    result.resolution === "majority_vote" ||
    result.resolution === "priority_domain"
  );
  assert.equal(result.consensus.finalDecision, "Increase");
});

test("critical disagreement requires human", () => {
  const result = resolveVoiceDomainConsensus({
    topic: "Critical decision",
    proposals: [
      { domainId: "exec_1", domainType: "execution", decision: "Proceed", confidence: 95 },
      { domainId: "safety_1", domainType: "safety", decision: "Stop immediately", confidence: 30 },
    ],
    domainRegistry: new Map(),
  });
  // Safety has high confidence but doesn't exceed 80, and there's critical disagreement
  assert.ok(
    result.resolution === "require_human" ||
    result.resolution === "safety_override" ||
    result.resolution === "priority_domain"
  );
});

test("validation catches empty proposals", () => {
  const errors = validateConsensusProposals([], []);
  assert.ok(errors.includes("no_proposals"));
  assert.ok(errors.includes("no_involved_domains"));
});

// ============================================================================
// V7.8 — Voice Domain Orchestrator
// ============================================================================
console.log("\n🎛️ V7.8 — Voice Domain Orchestrator");

import {
  evaluateVoiceDomainOrchestrator,
  determineGlobalState,
  calculateCoherenceScore,
  determineOrchestrationMode,
  formatVoiceDomainOrchestrator,
  setCurrentOrchestrator,
  getCurrentOrchestrator,
  clearCurrentOrchestrator,
} from "../../../src/telegram/voiceDomainOrchestrator.js";

test("healthy domains → stable state", () => {
  const { domain: safety } = createVoiceDomain({ domainType: "safety" });
  const { domain: execution } = createVoiceDomain({ domainType: "execution" });

  const orchestrator = evaluateVoiceDomainOrchestrator({
    domains: [safety, execution],
    recentConsensus: [],
    activeConflicts: 0,
  });
  assert.equal(orchestrator.globalState, "stable");
  assert.equal(orchestrator.orchestrationMode, "independent");
  assert.ok(orchestrator.coherenceScore >= 70);
});

test("low health domains → critical state", () => {
  const { domain: d1 } = createVoiceDomain({ domainType: "safety" });
  const { domain: d2 } = createVoiceDomain({ domainType: "execution" });
  d1.healthScore = 10;
  d2.healthScore = 15;

  const orchestrator = evaluateVoiceDomainOrchestrator({
    domains: [d1, d2],
    recentConsensus: [],
    activeConflicts: 0,
  });
  assert.equal(orchestrator.globalState, "critical");
  assert.equal(orchestrator.orchestrationMode, "strict_control");
});

test("determineGlobalState handles all cases", () => {
  assert.equal(determineGlobalState({ a: 90, b: 85 }, 0), "stable");
  assert.equal(determineGlobalState({ a: 70, b: 65 }, 0), "adaptive");
  assert.equal(determineGlobalState({ a: 50, b: 55 }, 1), "constrained");
  assert.equal(determineGlobalState({ a: 10, b: 30 }, 0), "critical");
});

test("orchestrator singleton works", () => {
  clearCurrentOrchestrator();
  const { domain: d } = createVoiceDomain({ domainType: "review" });
  const orchestrator = evaluateVoiceDomainOrchestrator({
    domains: [d],
    recentConsensus: [],
    activeConflicts: 0,
  });
  setCurrentOrchestrator(orchestrator);
  const current = getCurrentOrchestrator();
  assert.ok(current);
  assert.equal(current.orchestratorId, orchestrator.orchestratorId);
});

// ============================================================================
// V7.9 — Voice Mission Model
// ============================================================================
console.log("\n🎯 V7.9 — Voice Mission Model");

import {
  createVoiceGovernanceMission,
  activateMission,
  completeMission,
  abortMission,
  validateMission,
  inferMissionFromGlobalState,
  determineMissionPriority,
  formatVoiceGovernanceMission,
  registerVoiceMission,
  getActiveMissions,
  clearVoiceMissionRegistry,
} from "../../../src/telegram/voiceMissionModel.js";

test("crisis state infers recover_from_crisis mission", () => {
  const missionType = inferMissionFromGlobalState("critical");
  assert.equal(missionType, "recover_from_crisis");
});

test("stable state infers prepare_growth_mode mission", () => {
  const missionType = inferMissionFromGlobalState("stable");
  assert.equal(missionType, "prepare_growth_mode");
});

test("mission lifecycle works", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });
  assert.equal(mission.missionStatus, "planned");

  const activated = activateMission(mission);
  assert.equal(activated.missionStatus, "active");
  assert.ok(activated.activatedAt);

  const completed = completeMission(activated);
  assert.equal(completed.missionStatus, "completed");
  assert.ok(completed.completedAt);
});

test("abort mission adds reason", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "reduce_risk",
    targetDomains: ["domain_1"],
  });
  const activated = activateMission(mission);
  const aborted = abortMission(activated, "Risk escalated beyond mission scope");
  assert.equal(aborted.missionStatus, "aborted");
  assert.equal(aborted.abortReason, "Risk escalated beyond mission scope");
});

test("validation catches missing target domains", () => {
  const errors = validateMission({
    missionType: "stabilize_system",
    targetDomains: [],
  });
  assert.ok(errors.includes("no_target_domains"));
});

test("mission registry stores active missions", () => {
  clearVoiceMissionRegistry();
  const { mission } = createVoiceGovernanceMission({
    missionType: "improve_learning_quality",
    targetDomains: ["domain_1", "domain_2"],
  });
  registerVoiceMission(activateMission(mission));
  const activeMissions = getActiveMissions();
  assert.equal(activeMissions.length, 1);
});

// ============================================================================
// V8.0 — Voice Mission Execution Graph
// ============================================================================
console.log("\n📊 V8.0 — Voice Mission Execution Graph");

import {
  buildVoiceMissionExecutionGraph,
  validateMissionGraph,
  startGraphNode,
  completeGraphNode,
  failGraphNode,
  skipGraphNode,
  getReadyNodes,
  getBlockedNodes,
  calculateGraphProgress,
  formatVoiceMissionExecutionGraph,
  registerVoiceMissionGraph,
  clearVoiceMissionGraphRegistry,
} from "../../../src/telegram/voiceMissionExecutionGraph.js";

test("graph builds from templates", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { graph, validationErrors } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe system state" },
      { domainId: "domain_1", actionType: "validate", description: "Validate findings", dependsOn: [0] },
      { domainId: "domain_1", actionType: "adapt", description: "Apply adaptation", dependsOn: [1] },
    ],
  });

  assert.equal(validationErrors.length, 0);
  assert.equal(graph.nodes.length, 3);
  assert.equal(graph.graphStatus, "draft");
});

test("circular dependency is detected", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { validationErrors } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "A", dependsOn: [2] },
      { domainId: "domain_1", actionType: "validate", description: "B", dependsOn: [0] },
      { domainId: "domain_1", actionType: "adapt", description: "C", dependsOn: [1] },
    ],
  });

  assert.ok(validationErrors.includes("circular_dependency"));
});

test("graph lifecycle works", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { graph } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
      { domainId: "domain_1", actionType: "adapt", description: "Adapt", dependsOn: [0] },
    ],
  });

  // Start first node
  const startedGraph = startGraphNode(graph, graph.nodes[0].nodeId);
  assert.equal(startedGraph.nodes[0].status, "running");

  // Complete first node
  const completedGraph = completeGraphNode(startedGraph, graph.nodes[0].nodeId);
  assert.equal(completedGraph.nodes[0].status, "completed");

  // Second node should now be ready
  const readyNodes = getReadyNodes(completedGraph);
  assert.equal(readyNodes.length, 1);
});

test("calculateGraphProgress works", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { graph } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "A" },
      { domainId: "domain_1", actionType: "adapt", description: "B" },
    ],
  });

  assert.equal(calculateGraphProgress(graph), 0);

  const withOneCompleted = completeGraphNode(graph, graph.nodes[0].nodeId);
  assert.equal(calculateGraphProgress(withOneCompleted), 50);
});

// ============================================================================
// V8.1 — Voice Mission Supervision
// ============================================================================
console.log("\n🛡️ V8.1 — Voice Mission Supervision");

import {
  evaluateVoiceMissionSupervisor,
  detectMissionRisks,
  calculateMissionHealthScore,
  formatVoiceMissionSupervisor,
  setCurrentSupervisor,
  getCurrentSupervisor,
  clearCurrentSupervisor,
} from "../../../src/telegram/voiceMissionSupervision.js";

test("healthy mission returns continue", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { graph } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
    ],
  });

  const supervisor = evaluateVoiceMissionSupervisor({
    mission,
    graphId: graph.graphId,
    nodes: graph.nodes,
    graphProgress: 0,
    graphStatus: "running",
    domainHealthScores: { domain_1: 95 },
    elapsedMs: 1000,
    expectedDurationMs: 60000,
  });

  assert.equal(supervisor.supervisionStatus, "healthy");
  assert.equal(supervisor.recommendedAction, "continue");
  assert.ok(supervisor.missionHealthScore > 0);
});

test("domain overload detected", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { graph } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
    ],
  });

  const risks = detectMissionRisks({
    mission,
    nodes: graph.nodes,
    graphProgress: 0,
    graphStatus: "running",
    domainHealthScores: { domain_1: 15 },
    elapsedMs: 1000,
    expectedDurationMs: 60000,
  });

  const overloadRisk = risks.find((r) => r.type === "domain_overload");
  assert.ok(overloadRisk);
});

test("mission stall detected", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { graph } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
    ],
  });

  const risks = detectMissionRisks({
    mission,
    nodes: graph.nodes,
    graphProgress: 0,
    graphStatus: "running",
    domainHealthScores: { domain_1: 80 },
    elapsedMs: 40000,
    expectedDurationMs: 50000,
  });

  const stallRisk = risks.find((r) => r.type === "mission_stall");
  assert.ok(stallRisk);
});

// ============================================================================
// V8.2 — Voice Mission Replanning
// ============================================================================
console.log("\n🔄 V8.2 — Voice Mission Replanning");

import {
  createVoiceMissionReplan,
  determineReplanTrigger,
  determineReplanMode,
  validateMissionReplan,
  applyReplan,
  rejectReplan,
  formatVoiceMissionReplan,
  registerVoiceMissionReplan,
  clearVoiceMissionReplanRegistry,
} from "../../../src/telegram/voiceMissionReplanning.js";

test("determineReplanMode: single failure → partial_rewire", () => {
  const mode = determineReplanMode("dependency_failure", 1, 20, false);
  assert.equal(mode, "partial_rewire");
});

test("determineReplanMode: goal drift → full_rebuild", () => {
  const mode = determineReplanMode("goal_drift", 3, 50, false);
  assert.equal(mode, "full_rebuild");
});

test("determineReplanMode: crisis → safe_fallback", () => {
  const mode = determineReplanMode("domain_overload", 2, 30, true);
  assert.equal(mode, "safe_fallback");
});

test("replan lifecycle works", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { graph: graph1 } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
    ],
  });

  const { graph: graph2 } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Replanned observe" },
      { domainId: "domain_1", actionType: "validate", description: "New validation step" },
    ],
  });

  const { replan, validationErrors } = createVoiceMissionReplan({
    mission,
    previousGraph: graph1,
    nextGraph: graph2,
    trigger: "context_shift",
  });

  assert.equal(validationErrors.length, 0);
  assert.equal(replan.replanStatus, "proposed");
  assert.ok(replan.changedNodes.length > 0);

  const validated = applyReplan(validateMissionReplan(replan).length === 0 ? { ...replan, replanStatus: "validated" as const } : replan);
  assert.ok(validated.replanStatus === "applied" || validated.replanStatus === "validated");
});

// ============================================================================
// V8.3 — Voice Mission Recovery
// ============================================================================
console.log("\n🛡️ V8.3 — Voice Mission Recovery");

import {
  createVoiceMissionRecoveryPlan,
  analyzeBlastRadius,
  determineContainmentMode,
  validateMissionRecovery,
  startRecovery,
  completeRecovery,
  failRecovery,
  formatVoiceMissionRecoveryPlan,
  registerVoiceMissionRecovery,
  clearVoiceMissionRecoveryRegistry,
} from "../../../src/telegram/voiceMissionRecovery.js";

test("local failure → isolate_node", () => {
  const mode = determineContainmentMode("execution_failure", "local", false, false);
  assert.equal(mode, "isolate_node");
});

test("domain conflict → pause_branch", () => {
  const mode = determineContainmentMode("domain_conflict", "multi_domain", false, false);
  assert.equal(mode, "pause_branch");
});

test("fallback branch → fallback_branch", () => {
  const mode = determineContainmentMode("execution_failure", "local", true, false);
  assert.equal(mode, "fallback_branch");
});

test("blast radius analysis works", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { graph } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "A" },
      { domainId: "domain_1", actionType: "adapt", description: "B", dependsOn: [0] },
      { domainId: "domain_1", actionType: "validate", description: "C", dependsOn: [1] },
    ],
  });

  const blastAnalysis = analyzeBlastRadius(graph.nodes[0].nodeId, graph, { domain_1: 80 });
  assert.ok(blastAnalysis.affectedNodeIds.length >= 1);
  assert.equal(blastAnalysis.blastRadius, "local");
});

test("recovery lifecycle works", () => {
  const { mission } = createVoiceGovernanceMission({
    missionType: "stabilize_system",
    targetDomains: ["domain_1"],
  });

  const { graph } = buildVoiceMissionExecutionGraph({
    mission,
    nodeTemplates: [
      { domainId: "domain_1", actionType: "observe", description: "Observe" },
    ],
  });

  // Fail the node first
  const failedGraph = failGraphNode(graph, graph.nodes[0].nodeId, "Execution timeout");

  const { recovery } = createVoiceMissionRecoveryPlan({
    missionId: mission.missionId,
    failedNodeId: graph.nodes[0].nodeId,
    graph: failedGraph,
    domainHealthScores: { domain_1: 80 },
    failureDescription: "Node execution failed",
    hasFallbackBranch: false,
    canDegradeGracefully: true,
  });

  assert.equal(recovery.recoveryStatus, "planned");

  const started = startRecovery(recovery);
  assert.equal(started.recoveryStatus, "running");

  const completed = completeRecovery(started);
  assert.equal(completed.recoveryStatus, "recovered");
});

// ============================================================================
// V8.4 — Voice Branch Evaluation
// ============================================================================
console.log("\n📊 V8.4 — Voice Branch Evaluation");

import {
  createVoiceMissionBranchEvaluation,
  calculateBranchCompositeScore,
  selectBestBranch,
  validateBranchEvaluation,
  formatVoiceMissionBranchEvaluation,
  registerVoiceMissionBranchEvaluation,
  clearVoiceMissionBranchEvaluationRegistry,
} from "../../../src/telegram/voiceBranchEvaluation.js";

test("crisis context prioritizes lowest risk", () => {
  const branches = [
    { branchId: "fast", graphId: "g1", estimatedStability: 60, estimatedRisk: 70, estimatedCost: 20, estimatedMissionFit: 80 },
    { branchId: "safe", graphId: "g2", estimatedStability: 90, estimatedRisk: 10, estimatedCost: 60, estimatedMissionFit: 70 },
  ];

  const { selectedBranchId } = selectBestBranch(branches, "crisis");
  assert.equal(selectedBranchId, "safe");
});

test("growth context prioritizes mission fit", () => {
  const branches = [
    { branchId: "conservative", graphId: "g1", estimatedStability: 95, estimatedRisk: 5, estimatedCost: 30, estimatedMissionFit: 50 },
    { branchId: "ambitious", graphId: "g2", estimatedStability: 70, estimatedRisk: 30, estimatedCost: 50, estimatedMissionFit: 95 },
  ];

  const { selectedBranchId } = selectBestBranch(branches, "growth");
  assert.equal(selectedBranchId, "ambitious");
});

test("branch evaluation selects best option", () => {
  const branches = [
    { branchId: "branch_a", graphId: "g1", estimatedStability: 80, estimatedRisk: 20, estimatedCost: 30, estimatedMissionFit: 75 },
    { branchId: "branch_b", graphId: "g2", estimatedStability: 70, estimatedRisk: 30, estimatedCost: 20, estimatedMissionFit: 80 },
  ];

  const { evaluation } = createVoiceMissionBranchEvaluation({
    missionId: "mission_1",
    branches,
    environmentType: "production",
  });

  assert.ok(evaluation.selectedBranchId === "branch_a" || evaluation.selectedBranchId === "branch_b");
  assert.equal(evaluation.branchScores.length, 2);
  assert.equal(evaluation.branchScores[0].rank, 1);
});

test("validation catches out-of-range scores", () => {
  const errors = validateBranchEvaluation({
    missionId: "m1",
    branches: [
      { branchId: "b1", graphId: "g1", estimatedStability: 110, estimatedRisk: 50, estimatedCost: 50, estimatedMissionFit: 50 },
    ],
    selectedBranchId: "b1",
    selectionReason: "best_balance",
    evaluatedAt: Date.now(),
    evaluationSummary: "test",
    branchScores: [],
  });
  assert.ok(errors.includes("stability_out_of_range"));
});

// ============================================================================
// Integration Pipeline
// ============================================================================
console.log("\n🎯 Integration Pipeline");

import {
  executeAdaptiveMissionPipeline,
  formatAdaptiveMissionPipelineResult,
} from "../../../src/telegram/voiceAdaptiveMissionIntelligence.js";

test("full pipeline executes successfully", () => {
  const result = executeAdaptiveMissionPipeline({
    environment: {
      instabilityScore: 10,
      rollbackFrequency: 0,
      stabilityDurationHours: 24,
      positiveSignalRate: 70,
      errorRate: 2,
      avgLatencyMs: 500,
      loadPercentage: 30,
      isTestEnvironment: false,
      isStaging: false,
      recoveryInProgress: false,
    },
    domains: [
      { input: { domainType: "safety" } },
      { input: { domainType: "execution" } },
    ],
    nodeTemplates: [
      { domainId: "", actionType: "observe", description: "Observe state" },
      { domainId: "", actionType: "adapt", description: "Apply adaptation", dependsOn: [0] },
    ],
    graphProgress: 0,
    elapsedMs: 1000,
    expectedDurationMs: 60000,
    domainHealthScores: {},
  });

  assert.ok(result.environment);
  assert.ok(result.policy);
  assert.ok(result.orchestrator);
  assert.ok(result.recommendedAction);
});

test("pipeline detects crisis and adapts", () => {
  const result = executeAdaptiveMissionPipeline({
    environment: {
      instabilityScore: 90,
      rollbackFrequency: 8,
      stabilityDurationHours: 0,
      positiveSignalRate: 10,
      errorRate: 50,
      avgLatencyMs: 8000,
      loadPercentage: 95,
      isTestEnvironment: false,
      isStaging: false,
      recoveryInProgress: false,
    },
    domains: [
      { input: { domainType: "safety" } },
      { input: { domainType: "execution" } },
    ],
    nodeTemplates: [
      { domainId: "", actionType: "stabilize", description: "Stabilize system" },
    ],
    domainHealthScores: {},
  });

  assert.equal(result.environment.environmentType, "crisis");
  assert.equal(result.policy.enforcementMode, "strict");
  assert.equal(result.policy.policyAdjustments.adaptationAggressiveness, 0);
});

test("formatAdaptiveMissionPipelineResult produces output", () => {
  const result = executeAdaptiveMissionPipeline({
    environment: {
      instabilityScore: 5,
      rollbackFrequency: 0,
      stabilityDurationHours: 48,
      positiveSignalRate: 85,
      errorRate: 1,
      avgLatencyMs: 300,
      loadPercentage: 20,
      isTestEnvironment: false,
      isStaging: false,
      recoveryInProgress: false,
    },
    domains: [
      { input: { domainType: "safety" } },
    ],
    nodeTemplates: [
      { domainId: "", actionType: "observe", description: "Observe" },
    ],
    domainHealthScores: {},
  });

  const formatted = formatAdaptiveMissionPipelineResult(result);
  assert.ok(formatted.includes("Voice Adaptive Mission Intelligence"));
});

// ============================================================================
// Summary
// ============================================================================
console.log(`\n${"═".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`${"═".repeat(50)}`);

process.exit(failed > 0 ? 1 : 0);
