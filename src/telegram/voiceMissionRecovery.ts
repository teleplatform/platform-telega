/**
 * Voice Mission Recovery & Partial Failure Containment Layer v8.3
 *
 * First-class entity: VoiceMissionRecoveryPlan
 *
 * This layer answers:
 *   - "How should the system recover from a partial mission failure?"
 *   - "What is the blast radius of a node failure?"
 *   - "Should we isolate the node, pause the branch, use a fallback, or continue degraded?"
 *
 * This layer does NOT:
 *   - replan the entire graph (delegated to V8.2)
 *   - evaluate branches (delegated to V8.4)
 *   - supervise the mission (delegated to V8.1)
 *
 * RULE: FAILURE IN ONE MISSION BRANCH MUST NOT DESTROY THE WHOLE MISSION IF CONTAINMENT IS POSSIBLE
 */

import type { VoiceMissionGraphNode, VoiceMissionExecutionGraph } from "./voiceMissionExecutionGraph.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceMissionFailureType =
  | "execution_failure"
  | "dependency_break"
  | "domain_conflict"
  | "supervision_violation";

export type VoiceMissionContainmentMode =
  | "isolate_node"
  | "pause_branch"
  | "fallback_branch"
  | "degraded_execution";

export type VoiceMissionRecoveryStatus =
  | "planned"
  | "running"
  | "recovered"
  | "failed";

export type VoiceMissionBlastRadius =
  | "local"
  | "multi_domain"
  | "mission_wide";

export interface VoiceMissionRecoveryPlan {
  recoveryId: string;

  missionId: string;
  failedNodeId: string;

  failureType: VoiceMissionFailureType;

  containmentMode: VoiceMissionContainmentMode;

  recoveryStatus: VoiceMissionRecoveryStatus;

  blastRadius: VoiceMissionBlastRadius;

  createdAt: number;

  // Metadata
  failureDescription: string;
  affectedNodeIds: string[];
  affectedDomainIds: string[];
  recoveryActions: string[];

  // Lifecycle tracking
  recoveryStartedAt?: number;
  recoveryCompletedAt?: number;
  recoveryFailedAt?: number;
  failureReason?: string;
}

export type VoiceMissionRecoveryValidationError =
  | "invalid_failure_type"
  | "invalid_containment_mode"
  | "invalid_recovery_status"
  | "invalid_blast_radius"
  | "missing_mission_id"
  | "missing_failed_node_id"
  | "empty_failure_description";

// ============================================================================
// ID generation
// ============================================================================

function generateRecoveryId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_recovery_${timestamp}_${random}`;
}

function cryptoRandomHex(bytes: number): string {
  try {
    const { randomBytes } = require("node:crypto");
    return randomBytes(bytes).toString("hex");
  } catch {
    return Math.random().toString(16).slice(2, 2 + bytes * 2);
  }
}

// ============================================================================
// Validation
// ============================================================================

const VALID_FAILURE_TYPES: VoiceMissionFailureType[] = [
  "execution_failure",
  "dependency_break",
  "domain_conflict",
  "supervision_violation",
];

const VALID_CONTAINMENT_MODES: VoiceMissionContainmentMode[] = [
  "isolate_node",
  "pause_branch",
  "fallback_branch",
  "degraded_execution",
];

const VALID_RECOVERY_STATUSES: VoiceMissionRecoveryStatus[] = [
  "planned",
  "running",
  "recovered",
  "failed",
];

const VALID_BLAST_RADII: VoiceMissionBlastRadius[] = [
  "local",
  "multi_domain",
  "mission_wide",
];

export function validateMissionRecovery(
  recovery: Partial<VoiceMissionRecoveryPlan>,
): VoiceMissionRecoveryValidationError[] {
  const errors: VoiceMissionRecoveryValidationError[] = [];

  if (recovery.failureType && !VALID_FAILURE_TYPES.includes(recovery.failureType)) {
    errors.push("invalid_failure_type");
  }

  if (
    recovery.containmentMode &&
    !VALID_CONTAINMENT_MODES.includes(recovery.containmentMode)
  ) {
    errors.push("invalid_containment_mode");
  }

  if (
    recovery.recoveryStatus &&
    !VALID_RECOVERY_STATUSES.includes(recovery.recoveryStatus)
  ) {
    errors.push("invalid_recovery_status");
  }

  if (recovery.blastRadius && !VALID_BLAST_RADII.includes(recovery.blastRadius)) {
    errors.push("invalid_blast_radius");
  }

  if (!recovery.missionId || recovery.missionId.trim().length === 0) {
    errors.push("missing_mission_id");
  }

  if (!recovery.failedNodeId || recovery.failedNodeId.trim().length === 0) {
    errors.push("missing_failed_node_id");
  }

  if (
    recovery.failureDescription !== undefined &&
    recovery.failureDescription.trim().length === 0
  ) {
    errors.push("empty_failure_description");
  }

  return errors;
}

// ============================================================================
// Blast radius analysis
// ============================================================================

/**
 * Analyze the blast radius of a node failure.
 * Pure function — determines how far the failure spreads.
 */
export function analyzeBlastRadius(
  failedNodeId: string,
  graph: VoiceMissionExecutionGraph,
  domainHealthScores: Record<string, number>,
): {
  blastRadius: VoiceMissionBlastRadius;
  affectedNodeIds: string[];
  affectedDomainIds: string[];
} {
  const failedNode = graph.nodes.find((n) => n.nodeId === failedNodeId);
  if (!failedNode) {
    return {
      blastRadius: "local",
      affectedNodeIds: [],
      affectedDomainIds: [],
    };
  }

  const affectedNodeIds: string[] = [failedNodeId];
  const affectedDomainIds = new Set<string>([failedNode.domainId]);

  // Find all nodes that depend on the failed node (directly or transitively)
  const dependentNodes = findTransitiveDependents(failedNodeId, graph.nodes);
  for (const dep of dependentNodes) {
    affectedNodeIds.push(dep.nodeId);
    affectedDomainIds.add(dep.domainId);
  }

  // Determine blast radius
  let blastRadius: VoiceMissionBlastRadius;

  if (affectedDomainIds.size > 2) {
    blastRadius = "mission_wide";
  } else if (affectedDomainIds.size > 1) {
    blastRadius = "multi_domain";
  } else {
    blastRadius = "local";
  }

  // Escalate if domain health is critical
  const failedDomainHealth = domainHealthScores[failedNode.domainId] ?? 100;
  if (failedDomainHealth < 20 && blastRadius === "local") {
    blastRadius = "multi_domain";
  }

  return {
    blastRadius,
    affectedNodeIds,
    affectedDomainIds: Array.from(affectedDomainIds),
  };
}

/**
 * Find all nodes that transitively depend on the failed node.
 */
function findTransitiveDependents(
  failedNodeId: string,
  nodes: VoiceMissionGraphNode[],
): VoiceMissionGraphNode[] {
  const affected = new Map<string, VoiceMissionGraphNode>();
  const queue = [failedNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    for (const node of nodes) {
      if (node.dependsOn.includes(currentId) && !affected.has(node.nodeId)) {
        affected.set(node.nodeId, node);
        queue.push(node.nodeId);
      }
    }
  }

  return Array.from(affected.values());
}

// ============================================================================
// Containment mode determination
// ============================================================================

/**
 * Determine the appropriate containment mode based on failure type and blast radius.
 *
 * Rules:
 * - Local failure with intact dependencies → isolate_node
 * - Alternative branch exists → fallback_branch
 * - Domain conflict spreads → pause_branch
 * - Degraded execution possible → degraded_execution
 */
export function determineContainmentMode(
  failureType: VoiceMissionFailureType,
  blastRadius: VoiceMissionBlastRadius,
  hasFallbackBranch: boolean,
  canDegradeGracefully: boolean,
): VoiceMissionContainmentMode {
  // If we have a fallback branch, use it
  if (hasFallbackBranch) {
    return "fallback_branch";
  }

  // Domain conflict → pause the conflicting branch
  if (failureType === "domain_conflict") {
    return "pause_branch";
  }

  // Supervision violation → pause for human review
  if (failureType === "supervision_violation") {
    return "pause_branch";
  }

  // Dependency break → can we degrade gracefully?
  if (failureType === "dependency_break") {
    if (canDegradeGracefully) return "degraded_execution";
    return "pause_branch";
  }

  // Execution failure
  if (failureType === "execution_failure") {
    // Local failure → isolate
    if (blastRadius === "local") return "isolate_node";

    // Multi-domain or mission-wide → pause and assess
    if (blastRadius === "multi_domain") return "pause_branch";
    return "pause_branch";
  }

  // Default: isolate_node (least disruptive containment)
  return "isolate_node";
}

// ============================================================================
// Core recovery plan creation
// ============================================================================

export interface VoiceMissionRecoveryInput {
  missionId: string;
  failedNodeId: string;
  graph: VoiceMissionExecutionGraph;
  domainHealthScores: Record<string, number>;
  failureDescription: string;
  hasFallbackBranch: boolean;
  canDegradeGracefully: boolean;
}

/**
 * Create a mission recovery plan.
 * Pure function — analyzes failure, determines containment, builds plan.
 */
export function createVoiceMissionRecoveryPlan(
  input: VoiceMissionRecoveryInput,
): {
  recovery: VoiceMissionRecoveryPlan;
  validationErrors: VoiceMissionRecoveryValidationError[];
} {
  const blastAnalysis = analyzeBlastRadius(
    input.failedNodeId,
    input.graph,
    input.domainHealthScores,
  );

  const failedNode = input.graph.nodes.find(
    (n) => n.nodeId === input.failedNodeId,
  );

  const failureType = inferFailureType(failedNode, blastAnalysis);

  const containmentMode = determineContainmentMode(
    failureType,
    blastAnalysis.blastRadius,
    input.hasFallbackBranch,
    input.canDegradeGracefully,
  );

  const recoveryActions = generateRecoveryActions(
    containmentMode,
    blastAnalysis,
  );

  const recovery: VoiceMissionRecoveryPlan = {
    recoveryId: generateRecoveryId(),
    missionId: input.missionId,
    failedNodeId: input.failedNodeId,
    failureType,
    containmentMode,
    recoveryStatus: "planned",
    blastRadius: blastAnalysis.blastRadius,
    createdAt: Date.now(),
    failureDescription: input.failureDescription,
    affectedNodeIds: blastAnalysis.affectedNodeIds,
    affectedDomainIds: blastAnalysis.affectedDomainIds,
    recoveryActions,
  };

  const validationErrors = validateMissionRecovery(recovery);
  if (validationErrors.length > 0) {
    // Should never happen — fallback to safe defaults
    recovery.containmentMode = "pause_branch";
    recovery.blastRadius = "mission_wide";
    recovery.failureDescription += ` | Validation failed (${validationErrors.join(", ")}), fallback to safe defaults`;
  }

  return { recovery, validationErrors };
}

/**
 * Infer the failure type from the failed node and blast analysis.
 */
function inferFailureType(
  node: VoiceMissionGraphNode | undefined,
  blastAnalysis: ReturnType<typeof analyzeBlastRadius>,
): VoiceMissionFailureType {
  if (!node) return "execution_failure";

  // If node failed due to dependencies not being met
  if (node.status === "failed" && node.failureReason?.includes("dependency")) {
    return "dependency_break";
  }

  // If blast radius spans multiple domains
  if (blastAnalysis.affectedDomainIds.length > 1) {
    return "domain_conflict";
  }

  // Default: execution failure
  return "execution_failure";
}

/**
 * Generate recovery actions based on containment mode and blast analysis.
 */
function generateRecoveryActions(
  containmentMode: VoiceMissionContainmentMode,
  blastAnalysis: ReturnType<typeof analyzeBlastRadius>,
): string[] {
  const actions: string[] = [];

  switch (containmentMode) {
    case "isolate_node":
      actions.push(`Isolate failed node ${blastAnalysis.affectedNodeIds[0]}`);
      actions.push("Mark node as skipped in execution graph");
      actions.push("Check if dependent nodes can proceed with alternative path");
      break;

    case "pause_branch":
      actions.push(`Pause execution branch containing ${blastAnalysis.affectedNodeIds[0]}`);
      actions.push(`Affected nodes: ${blastAnalysis.affectedNodeIds.join(", ")}`);
      actions.push("Await human review or automatic recovery signal");
      break;

    case "fallback_branch":
      actions.push("Activate fallback execution branch");
      actions.push("Redirect dependent nodes to fallback path");
      actions.push("Monitor fallback execution health");
      break;

    case "degraded_execution":
      actions.push("Continue mission in degraded mode");
      actions.push("Skip failed node and mark as non-critical");
      actions.push("Reduce mission scope to essential nodes only");
      break;
  }

  return actions;
}

// ============================================================================
// Recovery lifecycle management
// ============================================================================

export function startRecovery(
  recovery: VoiceMissionRecoveryPlan,
): VoiceMissionRecoveryPlan {
  if (recovery.recoveryStatus !== "planned") {
    return recovery;
  }

  return {
    ...recovery,
    recoveryStatus: "running",
    recoveryStartedAt: Date.now(),
  };
}

export function completeRecovery(
  recovery: VoiceMissionRecoveryPlan,
): VoiceMissionRecoveryPlan {
  if (recovery.recoveryStatus !== "running") {
    return recovery;
  }

  return {
    ...recovery,
    recoveryStatus: "recovered",
    recoveryCompletedAt: Date.now(),
  };
}

export function failRecovery(
  recovery: VoiceMissionRecoveryPlan,
  reason: string,
): VoiceMissionRecoveryPlan {
  return {
    ...recovery,
    recoveryStatus: "failed",
    recoveryFailedAt: Date.now(),
    failureReason: reason,
  };
}

// ============================================================================
// Recovery registry
// ============================================================================

export interface VoiceMissionRecoveryRegistry {
  recoveries: Map<string, VoiceMissionRecoveryPlan>;
  maxRecoveries: number;
}

const DEFAULT_RECOVERY_MAX_REGISTRY = 50;

let _recoveryRegistry: VoiceMissionRecoveryRegistry = {
  recoveries: new Map(),
  maxRecoveries: DEFAULT_RECOVERY_MAX_REGISTRY,
};

export function getVoiceMissionRecoveryRegistry(): VoiceMissionRecoveryRegistry {
  return {
    recoveries: new Map(_recoveryRegistry.recoveries),
    maxRecoveries: _recoveryRegistry.maxRecoveries,
  };
}

export function registerVoiceMissionRecovery(
  recovery: VoiceMissionRecoveryPlan,
): void {
  if (_recoveryRegistry.recoveries.size >= _recoveryRegistry.maxRecoveries) {
    throw new Error(
      `Recovery registry full (max ${_recoveryRegistry.maxRecoveries}). Cannot register ${recovery.recoveryId}`,
    );
  }
  _recoveryRegistry.recoveries.set(recovery.recoveryId, recovery);
}

export function getVoiceMissionRecovery(
  recoveryId: string,
): VoiceMissionRecoveryPlan | undefined {
  return _recoveryRegistry.recoveries.get(recoveryId);
}

export function getRecoveriesForMission(
  missionId: string,
): VoiceMissionRecoveryPlan[] {
  return Array.from(_recoveryRegistry.recoveries.values()).filter(
    (r) => r.missionId === missionId,
  );
}

export function removeVoiceMissionRecovery(recoveryId: string): boolean {
  return _recoveryRegistry.recoveries.delete(recoveryId);
}

export function clearVoiceMissionRecoveryRegistry(): void {
  _recoveryRegistry = {
    recoveries: new Map(),
    maxRecoveries: DEFAULT_RECOVERY_MAX_REGISTRY,
  };
}

export function setVoiceMissionRecoveryRegistryForTest(
  registry: VoiceMissionRecoveryRegistry,
): void {
  _recoveryRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceMissionRecoveryPlan(
  recovery: VoiceMissionRecoveryPlan,
): string {
  const statusEmoji: Record<VoiceMissionRecoveryStatus, string> = {
    planned: "📋",
    running: "🚑",
    recovered: "✅",
    failed: "❌",
  };

  const containmentEmoji: Record<VoiceMissionContainmentMode, string> = {
    isolate_node: "🔒",
    pause_branch: "⏸️",
    fallback_branch: "🔄",
    degraded_execution: "⚠️",
  };

  const blastEmoji: Record<VoiceMissionBlastRadius, string> = {
    local: "🟢",
    multi_domain: "🟠",
    mission_wide: "🔴",
  };

  const lines = [
    `🛡️ Voice Mission Recovery Plan`,
    `• recovery ID: ${recovery.recoveryId}`,
    `• mission ID: ${recovery.missionId}`,
    `• failed node: ${recovery.failedNodeId}`,
    `• failure type: ${recovery.failureType}`,
    `• containment: ${containmentEmoji[recovery.containmentMode]} ${recovery.containmentMode}`,
    `• blast radius: ${blastEmoji[recovery.blastRadius]} ${recovery.blastRadius}`,
    `• status: ${statusEmoji[recovery.recoveryStatus]} ${recovery.recoveryStatus}`,
    `• description: ${recovery.failureDescription}`,
    `• affected nodes: ${recovery.affectedNodeIds.join(", ") || "none"}`,
    `• affected domains: ${recovery.affectedDomainIds.join(", ") || "none"}`,
    `• created at: ${new Date(recovery.createdAt).toISOString()}`,
    `--- Recovery Actions ---`,
    ...recovery.recoveryActions.map((a, i) => `  ${i + 1}. ${a}`),
  ];

  if (recovery.recoveryStartedAt) {
    lines.push(`• recovery started at: ${new Date(recovery.recoveryStartedAt).toISOString()}`);
  }

  if (recovery.recoveryCompletedAt) {
    lines.push(`• recovery completed at: ${new Date(recovery.recoveryCompletedAt).toISOString()}`);
  }

  if (recovery.recoveryFailedAt) {
    lines.push(`• recovery failed at: ${new Date(recovery.recoveryFailedAt).toISOString()}`);
    if (recovery.failureReason) {
      lines.push(`• reason: ${recovery.failureReason}`);
    }
  }

  return lines.join("\n");
}
