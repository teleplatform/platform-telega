/**
 * Voice Mission Replanning & Graph Reconstruction Layer v8.2
 *
 * First-class entity: VoiceMissionReplan
 *
 * This layer answers:
 *   - "When should a mission graph be replanned vs. just paused/stopped?"
 *   - "What kind of replanning is needed — partial rewire, full rebuild, or safe fallback?"
 *   - "Which nodes need to change, and is the replan validated?"
 *
 * This layer does NOT:
 *   - contain failures (delegated to V8.3)
 *   - evaluate branches (delegated to V8.4)
 *   - build the initial graph (delegated to V8.0)
 *
 * RULE: NO MISSION CONTINUES ON INVALID GRAPH WITHOUT REPLAN DECISION
 */

import type {
  VoiceMissionGraphNode,
  VoiceMissionExecutionGraph,
  VoiceMissionGraphStatus,
} from "./voiceMissionExecutionGraph.js";
import type { VoiceGovernanceMission, VoiceMissionType } from "./voiceMissionModel.js";
import type { VoiceMissionRiskType } from "./voiceMissionSupervision.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceMissionReplanTrigger =
  | "goal_drift"
  | "domain_overload"
  | "dependency_failure"
  | "context_shift"
  | "strategy_change";

export type VoiceMissionReplanMode =
  | "partial_rewire"
  | "full_rebuild"
  | "safe_fallback";

export type VoiceMissionReplanStatus =
  | "proposed"
  | "validated"
  | "applied"
  | "rejected";

export interface VoiceMissionReplan {
  replanId: string;

  missionId: string;
  previousGraphId: string;
  nextGraphId: string;

  trigger: VoiceMissionReplanTrigger;

  replanningMode: VoiceMissionReplanMode;

  changedNodes: string[]; // node IDs that were added/removed/modified

  replanStatus: VoiceMissionReplanStatus;

  createdAt: number;

  // Metadata
  reason: string;
  validationErrors: string[];
  appliedAt?: number;
  rejectedAt?: number;
}

export type VoiceMissionReplanValidationError =
  | "invalid_trigger"
  | "invalid_replan_mode"
  | "invalid_replan_status"
  | "missing_mission_id"
  | "missing_previous_graph_id"
  | "missing_next_graph_id";

// ============================================================================
// ID generation
// ============================================================================

function generateReplanId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_replan_${timestamp}_${random}`;
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

const VALID_REPLAN_TRIGGERS: VoiceMissionReplanTrigger[] = [
  "goal_drift",
  "domain_overload",
  "dependency_failure",
  "context_shift",
  "strategy_change",
];

const VALID_REPLAN_MODES: VoiceMissionReplanMode[] = [
  "partial_rewire",
  "full_rebuild",
  "safe_fallback",
];

const VALID_REPLAN_STATUSES: VoiceMissionReplanStatus[] = [
  "proposed",
  "validated",
  "applied",
  "rejected",
];

export function validateMissionReplan(
  replan: Partial<VoiceMissionReplan>,
): VoiceMissionReplanValidationError[] {
  const errors: VoiceMissionReplanValidationError[] = [];

  if (replan.trigger && !VALID_REPLAN_TRIGGERS.includes(replan.trigger)) {
    errors.push("invalid_trigger");
  }

  if (
    replan.replanningMode &&
    !VALID_REPLAN_MODES.includes(replan.replanningMode)
  ) {
    errors.push("invalid_replan_mode");
  }

  if (
    replan.replanStatus &&
    !VALID_REPLAN_STATUSES.includes(replan.replanStatus)
  ) {
    errors.push("invalid_replan_status");
  }

  if (!replan.missionId || replan.missionId.trim().length === 0) {
    errors.push("missing_mission_id");
  }

  if (
    !replan.previousGraphId ||
    replan.previousGraphId.trim().length === 0
  ) {
    errors.push("missing_previous_graph_id");
  }

  if (!replan.nextGraphId || replan.nextGraphId.trim().length === 0) {
    errors.push("missing_next_graph_id");
  }

  return errors;
}

// ============================================================================
// Replan trigger detection
// ============================================================================

/**
 * Determine the appropriate replan trigger from supervision risks.
 */
export function determineReplanTrigger(
  riskTypes: VoiceMissionRiskType[],
  contextChanged: boolean,
  strategyChanged: boolean,
): VoiceMissionReplanTrigger {
  // Context or strategy changes are direct triggers
  if (contextChanged) return "context_shift";
  if (strategyChanged) return "strategy_change";

  // Priority-based trigger selection
  if (riskTypes.includes("dependency_violation")) return "dependency_failure";
  if (riskTypes.includes("domain_overload")) return "domain_overload";
  if (riskTypes.includes("goal_drift")) return "goal_drift";

  // Default: context_shift (catch-all for unclassified issues)
  return "context_shift";
}

// ============================================================================
// Replan mode determination
// ============================================================================

/**
 * Determine the appropriate replanning mode based on trigger and graph state.
 *
 * Rules:
 * - Single dependency failure → partial_rewire
 * - Multiple failures or goal drift → full_rebuild
 * - Mission intent no longer matches context → full_rebuild
 * - Risk spikes hard during crisis → safe_fallback
 */
export function determineReplanMode(
  trigger: VoiceMissionReplanTrigger,
  failedNodeCount: number,
  graphProgress: number,
  isCrisisMission: boolean,
): VoiceMissionReplanMode {
  // Crisis missions with failures should fall back safely
  if (isCrisisMission && failedNodeCount > 0) {
    return "safe_fallback";
  }

  // Single dependency failure → partial rewire
  if (
    trigger === "dependency_failure" &&
    failedNodeCount <= 1
  ) {
    return "partial_rewire";
  }

  // Multiple failures or goal drift → full rebuild
  if (
    failedNodeCount > 2 ||
    trigger === "goal_drift" ||
    trigger === "strategy_change"
  ) {
    return "full_rebuild";
  }

  // Context shift → depends on progress
  if (trigger === "context_shift") {
    // Early in mission → full rebuild makes more sense
    if (graphProgress < 30) return "full_rebuild";
    // Late in mission → try to salvage with partial rewire
    return "partial_rewire";
  }

  // Domain overload → partial rewire (reroute around overloaded domain)
  if (trigger === "domain_overload") {
    return "partial_rewire";
  }

  // Default: partial rewire (least disruptive)
  return "partial_rewire";
}

// ============================================================================
// Changed nodes identification
// ============================================================================

/**
 * Identify which nodes changed between the previous and next graph.
 */
export function identifyChangedNodes(
  previousGraph: VoiceMissionExecutionGraph,
  nextGraph: VoiceMissionExecutionGraph,
): string[] {
  const changedNodes: string[] = [];

  const prevNodeIds = new Set(previousGraph.nodes.map((n) => n.nodeId));
  const nextNodeIds = new Set(nextGraph.nodes.map((n) => n.nodeId));

  // Nodes removed from previous graph
  for (const nodeId of prevNodeIds) {
    if (!nextNodeIds.has(nodeId)) {
      changedNodes.push(nodeId);
    }
  }

  // Nodes added in next graph
  for (const nodeId of nextNodeIds) {
    if (!prevNodeIds.has(nodeId)) {
      changedNodes.push(nodeId);
    }
  }

  // Nodes modified (same ID but different properties)
  for (const nextNode of nextGraph.nodes) {
    const prevNode = previousGraph.nodes.find((n) => n.nodeId === nextNode.nodeId);
    if (prevNode) {
      if (
        prevNode.actionType !== nextNode.actionType ||
        prevNode.domainId !== nextNode.domainId ||
        JSON.stringify(prevNode.dependsOn) !== JSON.stringify(nextNode.dependsOn) ||
        prevNode.priority !== nextNode.priority
      ) {
        if (!changedNodes.includes(nextNode.nodeId)) {
          changedNodes.push(nextNode.nodeId);
        }
      }
    }
  }

  return changedNodes;
}

// ============================================================================
// Core replan creation
// ============================================================================

export interface VoiceMissionReplanInput {
  mission: VoiceGovernanceMission;
  previousGraph: VoiceMissionExecutionGraph;
  nextGraph: VoiceMissionExecutionGraph;
  trigger: VoiceMissionReplanTrigger;
  reason?: string;
}

/**
 * Create a mission replan record.
 * Pure function — identifies changes and validates.
 */
export function createVoiceMissionReplan(
  input: VoiceMissionReplanInput,
): {
  replan: VoiceMissionReplan;
  validationErrors: VoiceMissionReplanValidationError[];
} {
  const changedNodes = identifyChangedNodes(
    input.previousGraph,
    input.nextGraph,
  );

  const replan: VoiceMissionReplan = {
    replanId: generateReplanId(),
    missionId: input.mission.missionId,
    previousGraphId: input.previousGraph.graphId,
    nextGraphId: input.nextGraph.graphId,
    trigger: input.trigger,
    replanningMode: determineReplanMode(
      input.trigger,
      input.previousGraph.nodes.filter((n) => n.status === "failed").length,
      calculateGraphProgress(input.previousGraph),
      input.mission.missionType === "recover_from_crisis",
    ),
    changedNodes,
    replanStatus: "proposed",
    createdAt: Date.now(),
    reason:
      input.reason ||
      `Replan triggered by ${input.trigger}: ${changedNodes.length} nodes changed`,
    validationErrors: [],
  };

  const validationErrors = validateMissionReplan(replan);
  if (validationErrors.length > 0) {
    replan.validationErrors = validationErrors.map((e) => e);
    replan.replanStatus = "rejected";
  }

  return { replan, validationErrors };
}

// ============================================================================
// Replan lifecycle management
// ============================================================================

export function validateReplan(
  replan: VoiceMissionReplan,
): VoiceMissionReplan {
  if (replan.replanStatus !== "proposed") {
    return replan;
  }

  const errors = validateMissionReplan(replan);
  if (errors.length > 0) {
    return {
      ...replan,
      replanStatus: "rejected",
      validationErrors: errors.map((e) => e),
      rejectedAt: Date.now(),
    };
  }

  return { ...replan, replanStatus: "validated" };
}

export function applyReplan(
  replan: VoiceMissionReplan,
): VoiceMissionReplan {
  if (replan.replanStatus !== "validated") {
    return replan;
  }

  return {
    ...replan,
    replanStatus: "applied",
    appliedAt: Date.now(),
  };
}

export function rejectReplan(
  replan: VoiceMissionReplan,
  reason: string,
): VoiceMissionReplan {
  return {
    ...replan,
    replanStatus: "rejected",
    validationErrors: [...replan.validationErrors, reason],
    rejectedAt: Date.now(),
  };
}

// ============================================================================
// Graph progress helper (duplicated from voiceMissionExecutionGraph to avoid circular deps)
// ============================================================================

function calculateGraphProgress(
  graph: VoiceMissionExecutionGraph,
): number {
  if (graph.nodes.length === 0) return 0;
  const completedCount = graph.nodes.filter(
    (n) => n.status === "completed" || n.status === "skipped",
  ).length;
  return Math.round((completedCount / graph.nodes.length) * 100);
}

// ============================================================================
// Replan registry
// ============================================================================

export interface VoiceMissionReplanRegistry {
  replans: Map<string, VoiceMissionReplan>;
  maxReplans: number;
}

const DEFAULT_REPLAN_MAX_REGISTRY = 100;

let _replanRegistry: VoiceMissionReplanRegistry = {
  replans: new Map(),
  maxReplans: DEFAULT_REPLAN_MAX_REGISTRY,
};

export function getVoiceMissionReplanRegistry(): VoiceMissionReplanRegistry {
  return {
    replans: new Map(_replanRegistry.replans),
    maxReplans: _replanRegistry.maxReplans,
  };
}

export function registerVoiceMissionReplan(replan: VoiceMissionReplan): void {
  if (_replanRegistry.replans.size >= _replanRegistry.maxReplans) {
    throw new Error(
      `Replan registry full (max ${_replanRegistry.maxReplans}). Cannot register ${replan.replanId}`,
    );
  }
  _replanRegistry.replans.set(replan.replanId, replan);
}

export function getVoiceMissionReplan(
  replanId: string,
): VoiceMissionReplan | undefined {
  return _replanRegistry.replans.get(replanId);
}

export function getReplansForMission(
  missionId: string,
): VoiceMissionReplan[] {
  return Array.from(_replanRegistry.replans.values()).filter(
    (r) => r.missionId === missionId,
  );
}

export function removeVoiceMissionReplan(replanId: string): boolean {
  return _replanRegistry.replans.delete(replanId);
}

export function clearVoiceMissionReplanRegistry(): void {
  _replanRegistry = {
    replans: new Map(),
    maxReplans: DEFAULT_REPLAN_MAX_REGISTRY,
  };
}

export function setVoiceMissionReplanRegistryForTest(
  registry: VoiceMissionReplanRegistry,
): void {
  _replanRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceMissionReplan(
  replan: VoiceMissionReplan,
): string {
  const statusEmoji: Record<VoiceMissionReplanStatus, string> = {
    proposed: "📝",
    validated: "✅",
    applied: "🚀",
    rejected: "❌",
  };

  const modeEmoji: Record<VoiceMissionReplanMode, string> = {
    partial_rewire: "🔧",
    full_rebuild: "🏗️",
    safe_fallback: "🛡️",
  };

  const lines = [
    `🔄 Voice Mission Replan`,
    `• replan ID: ${replan.replanId}`,
    `• mission ID: ${replan.missionId}`,
    `• previous graph: ${replan.previousGraphId}`,
    `• next graph: ${replan.nextGraphId}`,
    `• trigger: ${replan.trigger}`,
    `• mode: ${modeEmoji[replan.replanningMode]} ${replan.replanningMode}`,
    `• status: ${statusEmoji[replan.replanStatus]} ${replan.replanStatus}`,
    `• changed nodes: ${replan.changedNodes.length} (${replan.changedNodes.join(", ") || "none"})`,
    `• reason: ${replan.reason}`,
    `• created at: ${new Date(replan.createdAt).toISOString()}`,
  ];

  if (replan.validationErrors.length > 0) {
    lines.push(`• validation errors: ${replan.validationErrors.join(", ")}`);
  }

  if (replan.appliedAt) {
    lines.push(`• applied at: ${new Date(replan.appliedAt).toISOString()}`);
  }

  if (replan.rejectedAt) {
    lines.push(`• rejected at: ${new Date(replan.rejectedAt).toISOString()}`);
  }

  return lines.join("\n");
}

export function formatVoiceMissionReplanRegistry(
  registry: VoiceMissionReplanRegistry,
): string {
  const lines = [
    `🔄 Voice Mission Replan Registry (${registry.replans.size} replans)`,
  ];

  const recent = Array.from(registry.replans.values()).slice(-5);
  for (const replan of recent) {
    lines.push(
      `  [${replan.replanStatus}] ${replan.trigger} → ${replan.replanningMode} (${replan.changedNodes.length} nodes)`,
    );
  }

  return lines.join("\n");
}
