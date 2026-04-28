/**
 * Voice Adaptive Mission Intelligence — Integration Orchestrator v8.4
 *
 * Wires together all layers V7.3–V8.4 into a cohesive governance pipeline:
 *
 *   environment detected → policy adapted → transition controlled
 *   → domain orchestrated → mission planned → graph built
 *   → supervised → replanned → recovered → branch evaluated
 *
 * This is the top-level facade that coordinates the full adaptive mission lifecycle.
 *
 * Layers:
 *   V7.3 — VoiceEnvironmentContext (environment detection)
 *   V7.4 — VoiceContextAwarePolicy (policy adaptation)
 *   V7.5 — VoiceEnvironmentTransition (context switch governance)
 *   V7.6 — VoiceDomain (domain segmentation)
 *   V7.7 — VoiceDomainConsensus (cross-domain coordination)
 *   V7.8 — VoiceDomainOrchestrator (global coherence)
 *   V7.9 — VoiceGovernanceMission (mission model)
 *   V8.0 — VoiceMissionExecutionGraph (execution graph)
 *   V8.1 — VoiceMissionSupervisor (mission supervision)
 *   V8.2 — VoiceMissionReplan (replanning)
 *   V8.3 — VoiceMissionRecoveryPlan (recovery & containment)
 *   V8.4 — VoiceMissionBranchEvaluation (branch selection)
 */

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  VoiceEnvironmentContext,
  VoiceEnvironmentType,
  VoiceSystemLoad,
  VoiceRiskLevel,
  VoiceAdaptationAllowance,
  VoiceEnvironmentIndicator,
  VoiceEnvironmentDetectionInput,
  VoiceEnvironmentDetectionResult,
  VoiceEnvironmentContextRegistry,
} from "./voiceEnvironmentContext.js";

export type {
  VoiceContextAwarePolicy,
  VoicePolicyAdjustments,
  VoiceEnforcementMode,
} from "./voiceContextAwarePolicy.js";

export type {
  VoiceEnvironmentTransition,
  VoiceEnvironmentTransitionTrigger,
  VoiceEnvironmentTransitionMode,
  VoiceEnvironmentTransitionStatus,
} from "./voiceEnvironmentTransition.js";

export type {
  VoiceDomain,
  VoiceDomainType,
  VoiceDomainIsolationLevel,
  VoiceDomainRiskProfile,
  VoiceDomainRegistry,
} from "./voiceDomainSegmentation.js";

export type {
  VoiceDomainConsensus,
  VoiceDomainConsensusResolution,
} from "./voiceDomainConsensus.js";

export type {
  VoiceDomainOrchestrator,
  VoiceGlobalState,
  VoiceOrchestrationMode,
} from "./voiceDomainOrchestrator.js";

export type {
  VoiceGovernanceMission,
  VoiceMissionType,
  VoiceMissionPriority,
  VoiceMissionHorizon,
  VoiceMissionStatus,
} from "./voiceMissionModel.js";

export type {
  VoiceMissionExecutionGraph,
  VoiceMissionGraphNode,
  VoiceMissionActionType,
  VoiceMissionExecutionMode,
  VoiceMissionGraphStatus,
} from "./voiceMissionExecutionGraph.js";

export type {
  VoiceMissionSupervisor,
  VoiceMissionSupervisionStatus,
  VoiceMissionRisk,
  VoiceMissionRiskType,
  VoiceMissionRecommendedAction,
} from "./voiceMissionSupervision.js";

export type {
  VoiceMissionReplan,
  VoiceMissionReplanTrigger,
  VoiceMissionReplanMode,
  VoiceMissionReplanStatus,
} from "./voiceMissionReplanning.js";

export type {
  VoiceMissionRecoveryPlan,
  VoiceMissionFailureType,
  VoiceMissionContainmentMode,
  VoiceMissionRecoveryStatus,
  VoiceMissionBlastRadius,
} from "./voiceMissionRecovery.js";

export type {
  VoiceMissionBranchEvaluation,
  VoiceMissionBranch,
  VoiceBranchSelectionReason,
} from "./voiceBranchEvaluation.js";

// ============================================================================
// Core imports
// ============================================================================

import {
  detectVoiceEnvironment,
  detectVoiceEnvironment as detectEnv,
  setCurrentEnvironmentContext,
  getVoiceEnvironmentContextRegistry,
  type VoiceEnvironmentDetectionInput,
  type VoiceEnvironmentContext,
} from "./voiceEnvironmentContext.js";

import {
  generateVoiceContextAwarePolicy,
  setActiveVoiceContextAwarePolicy,
  type VoiceContextAwarePolicyInput,
  type VoiceContextAwarePolicy,
} from "./voiceContextAwarePolicy.js";

import {
  createVoiceEnvironmentTransition,
  addVoiceEnvironmentTransition,
  completeTransition,
  type VoiceEnvironmentTransitionInput,
  type VoiceEnvironmentTransition,
} from "./voiceEnvironmentTransition.js";

import {
  createVoiceDomain,
  registerVoiceDomain,
  getVoiceDomainRegistry,
  getAllVoiceDomains,
  type VoiceDomainInput,
  type VoiceDomain,
} from "./voiceDomainSegmentation.js";

import {
  resolveVoiceDomainConsensus,
  recordVoiceDomainConsensus,
  type VoiceConsensusInput,
  type VoiceDomainConsensus,
} from "./voiceDomainConsensus.js";

import {
  evaluateVoiceDomainOrchestrator,
  setCurrentOrchestrator,
  getCurrentOrchestrator,
  type VoiceOrchestratorInput,
  type VoiceDomainOrchestrator,
} from "./voiceDomainOrchestrator.js";

import {
  createVoiceGovernanceMission,
  activateMission,
  registerVoiceMission,
  inferMissionFromGlobalState,
  determineMissionPriority,
  determineMissionHorizon,
  type VoiceMissionInput,
  type VoiceGovernanceMission,
} from "./voiceMissionModel.js";

import {
  buildVoiceMissionExecutionGraph,
  registerVoiceMissionGraph,
  startVoiceGraph,
  type VoiceMissionGraphInput,
  type VoiceMissionExecutionGraph,
} from "./voiceMissionExecutionGraph.js";

import {
  evaluateVoiceMissionSupervisor,
  setCurrentSupervisor,
  getCurrentSupervisor,
  type VoiceMissionSupervisionInput,
  type VoiceMissionSupervisor,
  type VoiceMissionRecommendedAction,
} from "./voiceMissionSupervision.js";

import {
  createVoiceMissionReplan,
  registerVoiceMissionReplan,
  applyReplan,
  type VoiceMissionReplanInput,
  type VoiceMissionReplan,
} from "./voiceMissionReplanning.js";

import {
  createVoiceMissionRecoveryPlan,
  registerVoiceMissionRecovery,
  type VoiceMissionRecoveryInput,
  type VoiceMissionRecoveryPlan,
} from "./voiceMissionRecovery.js";

import {
  createVoiceMissionBranchEvaluation,
  registerVoiceMissionBranchEvaluation,
  estimateBranchesFromGraphs,
  type VoiceMissionBranchEvaluationInput,
  type VoiceMissionBranchEvaluation,
  type VoiceBranchEstimationInput,
} from "./voiceBranchEvaluation.js";

// ============================================================================
// Integration pipeline
// ============================================================================

/**
 * Full pipeline result from environment detection through branch evaluation.
 */
export interface VoiceAdaptiveMissionPipelineResult {
  environment: VoiceEnvironmentContext;
  policy: VoiceContextAwarePolicy;
  transition?: VoiceEnvironmentTransition;
  orchestrator: VoiceDomainOrchestrator;
  mission?: VoiceGovernanceMission;
  graph?: VoiceMissionExecutionGraph;
  supervisor?: VoiceMissionSupervisor;
  recommendedAction: VoiceMissionRecommendedAction;
  recoveryPlan?: VoiceMissionRecoveryPlan;
  branchEvaluation?: VoiceMissionBranchEvaluation;
}

/**
 * Input for the full adaptive mission pipeline.
 */
export interface VoiceAdaptiveMissionPipelineInput {
  environment: VoiceEnvironmentDetectionInput;
  domains: Array<{ input: VoiceDomainInput; policies?: string[] }>;
  nodeTemplates?: Array<{
    domainId: string;
    actionType: import("./voiceMissionExecutionGraph.js").VoiceMissionActionType;
    description: string;
    dependsOn?: number[];
    estimatedDurationMs?: number;
    priority?: number;
  }>;
  graphProgress?: number;
  elapsedMs?: number;
  expectedDurationMs?: number;
  domainHealthScores?: Record<string, number>;
  alternativeGraphs?: import("./voiceMissionExecutionGraph.js").VoiceMissionExecutionGraph[];
}

/**
 * Execute the full adaptive mission intelligence pipeline.
 *
 * Pipeline flow:
 *   1. Detect environment context (V7.3)
 *   2. Generate context-aware policy (V7.4)
 *   3. Evaluate environment transition if context changed (V7.5)
 *   4. Register domains and evaluate orchestrator (V7.6, V7.8)
 *   5. Infer and create mission from global state (V7.9)
 *   6. Build execution graph (V8.0)
 *   7. Supervise mission execution (V8.1)
 *   8. Create recovery plan if needed (V8.3)
 *   9. Evaluate branches if alternatives exist (V8.4)
 *
 * Pure function — all side effects are through registry updates.
 */
export function executeAdaptiveMissionPipeline(
  input: VoiceAdaptiveMissionPipelineInput,
): VoiceAdaptiveMissionPipelineResult {
  // ─── Step 1: Detect environment (V7.3) ───
  const envResult = detectVoiceEnvironment(input.environment);
  setCurrentEnvironmentContext(envResult.context);

  // ─── Step 2: Generate context-aware policy (V7.4) ───
  const policyInput: VoiceContextAwarePolicyInput = {
    environmentType: envResult.context.environmentType,
    riskLevel: envResult.context.riskLevel,
    adaptationAllowance: envResult.context.adaptationAllowance,
    sourceContextId: envResult.context.contextId,
  };
  const policy = generateVoiceContextAwarePolicy(policyInput);
  setActiveVoiceContextAwarePolicy(policy);

  // ─── Step 3: Register domains (V7.6) ───
  for (const domainDef of input.domains) {
    const { domain } = createVoiceDomain({
      ...domainDef.input,
      activePolicies: domainDef.policies,
    });
    registerVoiceDomain(domain);
  }

  const domains = getAllVoiceDomains();
  const domainHealthScores = input.domainHealthScores ??
    Object.fromEntries(domains.map((d) => [d.domainId, d.healthScore]));

  // ─── Step 4: Evaluate orchestrator (V7.8) ───
  const orchestratorInput: VoiceOrchestratorInput = {
    domains,
    recentConsensus: [],
    activeConflicts: 0,
  };
  const orchestrator = evaluateVoiceDomainOrchestrator(orchestratorInput);
  setCurrentOrchestrator(orchestrator);

  // ─── Step 5: Infer and create mission (V7.9) ───
  const missionType = inferMissionFromGlobalState(orchestrator.globalState);
  const priority = determineMissionPriority(
    orchestrator.globalState,
    envResult.context.riskLevel === "critical" ? 90 :
    envResult.context.riskLevel === "high" ? 70 :
    envResult.context.riskLevel === "medium" ? 40 : 20,
  );
  const horizon = determineMissionHorizon(missionType, orchestrator.globalState);

  const targetDomains = domains.filter((d) => d.enabled).map((d) => d.domainId);

  let mission: VoiceGovernanceMission | undefined;
  let graph: VoiceMissionExecutionGraph | undefined;
  let supervisor: VoiceMissionSupervisor | undefined;
  let recoveryPlan: VoiceMissionRecoveryPlan | undefined;
  let branchEvaluation: VoiceMissionBranchEvaluation | undefined;

  if (targetDomains.length > 0 && input.nodeTemplates && input.nodeTemplates.length > 0) {
    // Map node template dependsOn indices to actual node IDs will be done by buildVoiceMissionExecutionGraph

    const missionInput: VoiceMissionInput = {
      missionType,
      targetDomains,
      priority,
      missionHorizon: horizon,
      initiatedBy: "adaptive_pipeline",
    };
    const missionResult = createVoiceGovernanceMission(missionInput);
    mission = missionResult.mission;
    activateMission(mission);
    registerVoiceMission(mission);

    // ─── Step 6: Build execution graph (V8.0) ───
    const graphInput: VoiceMissionGraphInput = {
      mission,
      nodeTemplates: input.nodeTemplates,
    };
    const graphResult = buildVoiceMissionExecutionGraph(graphInput);
    graph = graphResult.graph;
    registerVoiceMissionGraph(graph);

    // ─── Step 7: Supervise mission (V8.1) ───
    const supervisionInput: VoiceMissionSupervisionInput = {
      mission,
      nodes: graph.nodes,
      graphProgress: input.graphProgress ?? 0,
      graphStatus: graph.graphStatus,
      domainHealthScores,
      elapsedMs: input.elapsedMs ?? 0,
      expectedDurationMs: input.expectedDurationMs,
    };
    supervisor = evaluateVoiceMissionSupervisor({
      ...supervisionInput,
      graphId: graph.graphId,
      previousSupervisor: getCurrentSupervisor() ?? undefined,
    });
    setCurrentSupervisor(supervisor);

    // ─── Step 8: Create recovery plan if supervisor recommends halt/pause ───
    if (
      supervisor.recommendedAction === "halt" ||
      supervisor.recommendedAction === "pause"
    ) {
      const failedNode = graph.nodes.find((n) => n.status === "failed");
      if (failedNode) {
        const recoveryInput: VoiceMissionRecoveryInput = {
          missionId: mission.missionId,
          failedNodeId: failedNode.nodeId,
          graph,
          domainHealthScores,
          failureDescription: failedNode.failureReason ?? "Node execution failed",
          hasFallbackBranch: false,
          canDegradeGracefully: supervisor.missionHealthScore > 40,
        };
        const recoveryResult = createVoiceMissionRecoveryPlan(recoveryInput);
        recoveryPlan = recoveryResult.recovery;
        registerVoiceMissionRecovery(recoveryPlan);
      }
    }

    // ─── Step 9: Evaluate branches if alternatives exist (V8.4) ───
    if (input.alternativeGraphs && input.alternativeGraphs.length > 0) {
      const estimationInput: VoiceBranchEstimationInput = {
        missionId: mission.missionId,
        graphs: [graph, ...input.alternativeGraphs],
        domainHealthScores,
      };
      const branches = estimateBranchesFromGraphs(estimationInput);

      const branchEvalInput: VoiceMissionBranchEvaluationInput = {
        missionId: mission.missionId,
        branches,
        environmentType: envResult.context.environmentType,
      };
      const branchEvalResult = createVoiceMissionBranchEvaluation(branchEvalInput);
      branchEvaluation = branchEvalResult.evaluation;
      registerVoiceMissionBranchEvaluation(branchEvaluation);
    }
  }

  return {
    environment: envResult.context,
    policy,
    orchestrator,
    mission,
    graph,
    supervisor,
    recommendedAction: supervisor?.recommendedAction ?? "continue",
    recoveryPlan,
    branchEvaluation,
  };
}

// ============================================================================
// Pipeline formatter
// ============================================================================

export function formatAdaptiveMissionPipelineResult(
  result: VoiceAdaptiveMissionPipelineResult,
): string {
  const lines = [
    `═══════════════════════════════════════════════════════`,
    `🎯 Voice Adaptive Mission Intelligence — Pipeline Result`,
    `═══════════════════════════════════════════════════════`,
    ``,
    `🌍 ENVIRONMENT: ${result.environment.environmentType} [${result.environment.systemLoad}] risk=${result.environment.riskLevel}`,
    `📋 POLICY: ${result.policy.enforcementMode} mode, adaptation=${result.policy.policyAdjustments.adaptationAggressiveness}`,
    `🎛️ ORCHESTRATOR: ${result.orchestrator.globalState} coherence=${result.orchestrator.coherenceScore}%`,
    ``,
  ];

  if (result.mission) {
    lines.push(`🎯 MISSION: ${result.mission.missionType} [${result.mission.priority}] status=${result.mission.missionStatus}`);
  }

  if (result.graph) {
    const completedCount = result.graph.nodes.filter(
      (n) => n.status === "completed" || n.status === "skipped",
    ).length;
    lines.push(`📊 GRAPH: ${result.graph.graphStatus} ${completedCount}/${result.graph.nodes.length} nodes`);
  }

  if (result.supervisor) {
    lines.push(`🛡️ SUPERVISOR: ${result.supervisor.supervisionStatus} health=${result.supervisor.missionHealthScore}% action=${result.supervisor.recommendedAction}`);
  }

  if (result.recoveryPlan) {
    lines.push(`🛡️ RECOVERY: ${result.recoveryPlan.containmentMode} blast=${result.recoveryPlan.blastRadius}`);
  }

  if (result.branchEvaluation) {
    lines.push(`📊 BRANCH EVAL: selected=${result.branchEvaluation.selectedBranchId} reason=${result.branchEvaluation.selectionReason}`);
  }

  lines.push(``);
  lines.push(`═══════════════════════════════════════════════════════`);

  return lines.join("\n");
}
