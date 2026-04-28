/**
 * Voice Mission Supervision & Long-Run Execution Governor v8.1
 *
 * First-class entity: VoiceMissionSupervisor
 *
 * This layer answers:
 *   - "Is the mission still executing correctly and toward the right goal?"
 *   - "What risks have been detected in the current mission execution?"
 *   - "Should the mission continue, pause, replan, or halt?"
 *
 * This layer does NOT:
 *   - define the mission (delegated to V7.9)
 *   - build the execution graph (delegated to V8.0)
 *   - replan the mission (delegated to V8.2)
 *
 * RULE: NO LONG-RUN MISSION MAY CONTINUE UNDER CRITICAL SUPERVISION FAILURE
 */

import type { VoiceMissionGraphNode, VoiceMissionExecutionGraph } from "./voiceMissionExecutionGraph.js";
import type { VoiceGovernanceMission } from "./voiceMissionModel.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceMissionSupervisionStatus =
  | "healthy"
  | "watching"
  | "intervening"
  | "halting";

export type VoiceMissionRiskType =
  | "goal_drift"
  | "domain_overload"
  | "dependency_violation"
  | "mission_stall"
  | "cross_domain_conflict";

export type VoiceMissionRecommendedAction =
  | "continue"
  | "pause"
  | "replan"
  | "halt";

export interface VoiceMissionRisk {
  type: VoiceMissionRiskType;
  severity: number; // 0..100
  description: string;
  detectedAt: number;
  affectedNodeIds?: string[];
}

export interface VoiceMissionSupervisor {
  supervisorId: string;

  missionId: string;
  graphId: string;

  supervisionStatus: VoiceMissionSupervisionStatus;

  missionHealthScore: number; // 0..100

  detectedRisks: VoiceMissionRisk[];

  recommendedAction: VoiceMissionRecommendedAction;

  evaluatedAt: number;

  // Metadata
  evaluationSummary: string;
  consecutiveWarnings: number;
  lastHealthyAt?: number;
}

export type VoiceMissionSupervisorValidationError =
  | "health_score_out_of_range"
  | "negative_consecutive_warnings"
  | "invalid_supervision_status"
  | "invalid_recommended_action";

// ============================================================================
// ID generation
// ============================================================================

function generateSupervisorId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_supervisor_${timestamp}_${random}`;
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

const VALID_SUPERVISION_STATUSES: VoiceMissionSupervisionStatus[] = [
  "healthy",
  "watching",
  "intervening",
  "halting",
];

const VALID_RECOMMENDED_ACTIONS: VoiceMissionRecommendedAction[] = [
  "continue",
  "pause",
  "replan",
  "halt",
];

export function validateMissionSupervisor(
  supervisor: Partial<VoiceMissionSupervisor>,
): VoiceMissionSupervisorValidationError[] {
  const errors: VoiceMissionSupervisorValidationError[] = [];

  if (
    supervisor.missionHealthScore !== undefined &&
    (supervisor.missionHealthScore < 0 || supervisor.missionHealthScore > 100)
  ) {
    errors.push("health_score_out_of_range");
  }

  if (
    supervisor.consecutiveWarnings !== undefined &&
    supervisor.consecutiveWarnings < 0
  ) {
    errors.push("negative_consecutive_warnings");
  }

  if (
    supervisor.supervisionStatus &&
    !VALID_SUPERVISION_STATUSES.includes(supervisor.supervisionStatus)
  ) {
    errors.push("invalid_supervision_status");
  }

  if (
    supervisor.recommendedAction &&
    !VALID_RECOMMENDED_ACTIONS.includes(supervisor.recommendedAction)
  ) {
    errors.push("invalid_recommended_action");
  }

  return errors;
}

// ============================================================================
// Risk detection
// ============================================================================

export interface VoiceMissionSupervisionInput {
  mission: VoiceGovernanceMission;
  nodes: VoiceMissionGraphNode[];
  graphProgress: number; // 0..100
  graphStatus: string;
  domainHealthScores: Record<string, number>;
  elapsedMs: number;
  expectedDurationMs?: number;
}

/**
 * Detect mission risks from execution state.
 * Pure function — analyzes and returns detected risks.
 */
export function detectMissionRisks(
  input: VoiceMissionSupervisionInput,
): VoiceMissionRisk[] {
  const risks: VoiceMissionRisk[] = [];
  const now = Date.now();

  // --- GOAL DRIFT detection ---
  // If mission is blocked/aborted but graph is still running, goal drift may be occurring
  if (
    (input.mission.missionStatus === "blocked" ||
      input.mission.missionStatus === "aborted") &&
    input.graphStatus === "running"
  ) {
    risks.push({
      type: "goal_drift",
      severity: 70,
      description: `Mission status is ${input.mission.missionStatus} but graph still running — possible goal drift`,
      detectedAt: now,
    });
  }

  // --- DOMAIN OVERLOAD detection ---
  for (const [domainId, health] of Object.entries(input.domainHealthScores)) {
    if (health < 30) {
      const affectedNodes = input.nodes
        .filter((n) => n.domainId === domainId && n.status === "pending")
        .map((n) => n.nodeId);

      risks.push({
        type: "domain_overload",
        severity: Math.round(100 - health),
        description: `Domain ${domainId} health is ${health}% — potential overload`,
        detectedAt: now,
        affectedNodeIds: affectedNodes,
      });
    }
  }

  // --- DEPENDENCY VIOLATION detection ---
  for (const node of input.nodes) {
    if (node.status === "running") {
      const depsMet = node.dependsOn.every((depId) => {
        const depNode = input.nodes.find((n) => n.nodeId === depId);
        return depNode && (depNode.status === "completed" || depNode.status === "skipped");
      });

      if (!depsMet) {
        risks.push({
          type: "dependency_violation",
          severity: 60,
          description: `Node ${node.nodeId} is running but dependencies are not met`,
          detectedAt: now,
          affectedNodeIds: [node.nodeId],
        });
      }
    }
  }

  // --- MISSION STALL detection ---
  // If graph is running but progress is 0 and elapsed time is significant
  if (
    input.graphStatus === "running" &&
    input.graphProgress === 0 &&
    input.expectedDurationMs &&
    input.elapsedMs > input.expectedDurationMs * 0.5
  ) {
    risks.push({
      type: "mission_stall",
      severity: 80,
      description: `Mission running but 0% progress after ${input.elapsedMs}ms (expected ${input.expectedDurationMs}ms)`,
      detectedAt: now,
    });
  }

  // --- CROSS-DOMAIN CONFLICT detection ---
  // If multiple domains have low health simultaneously
  const lowHealthDomains = Object.entries(input.domainHealthScores)
    .filter(([, health]) => health < 50)
    .map(([id]) => id);

  if (lowHealthDomains.length > 1) {
    const affectedNodes = input.nodes
      .filter((n) => lowHealthDomains.includes(n.domainId))
      .map((n) => n.nodeId);

    risks.push({
      type: "cross_domain_conflict",
      severity: Math.round(40 + lowHealthDomains.length * 10),
      description: `${lowHealthDomains.length} domains with health < 50%: ${lowHealthDomains.join(", ")}`,
      detectedAt: now,
      affectedNodeIds: affectedNodes,
    });
  }

  return risks;
}

// ============================================================================
// Health score calculation
// ============================================================================

/**
 * Calculate mission health score from risks and progress.
 */
export function calculateMissionHealthScore(
  risks: VoiceMissionRisk[],
  graphProgress: number,
  graphStatus: string,
): number {
  // Start with progress-based baseline (minimum 60 for new missions)
  let health = Math.max(60, graphProgress * 0.5);

  // Add status bonus
  switch (graphStatus) {
    case "running":
      health += 10;
      break;
    case "completed":
      health += 50;
      break;
    case "paused":
      health += 5;
      break;
    case "failed":
      health -= 30;
      break;
  }

  // Subtract risk penalties
  for (const risk of risks) {
    health -= (risk.severity / 100) * 20;
  }

  // Critical risks (severity >= 80) add extra penalty
  const criticalRisks = risks.filter((r) => r.severity >= 80);
  health -= criticalRisks.length * 15;

  return Math.round(Math.max(0, Math.min(100, health)));
}

// ============================================================================
// Supervision status determination
// ============================================================================

function determineSupervisionStatus(
  healthScore: number,
  risks: VoiceMissionRisk[],
): VoiceMissionSupervisionStatus {
  // Halting: health < 20 OR any critical risk (severity >= 90)
  if (healthScore < 20 || risks.some((r) => r.severity >= 90)) {
    return "halting";
  }

  // Intervening: health < 50 OR any high severity risk (severity >= 70)
  if (healthScore < 50 || risks.some((r) => r.severity >= 70)) {
    return "intervening";
  }

  // Watching: health < 70 OR any medium severity risk (severity >= 40)
  if (healthScore < 70 || risks.some((r) => r.severity >= 40)) {
    return "watching";
  }

  // Healthy: everything looks good
  return "healthy";
}

// ============================================================================
// Recommended action determination
// ============================================================================

function determineRecommendedAction(
  supervisionStatus: VoiceMissionSupervisionStatus,
  risks: VoiceMissionRisk[],
): VoiceMissionRecommendedAction {
  switch (supervisionStatus) {
    case "halting":
      return "halt";

    case "intervening":
      // If there are recoverable risks, recommend replan; otherwise pause
      const hasRecoverableRisks = risks.some(
        (r) => r.type === "domain_overload" || r.type === "dependency_violation",
      );
      return hasRecoverableRisks ? "replan" : "pause";

    case "watching":
      // If mission stall detected, recommend pause; otherwise continue
      const hasStall = risks.some((r) => r.type === "mission_stall");
      return hasStall ? "pause" : "continue";

    case "healthy":
      return "continue";
  }
}

// ============================================================================
// Core supervision evaluation
// ============================================================================

export interface VoiceMissionSupervisionCreateInput extends VoiceMissionSupervisionInput {
  graphId: string;
  previousSupervisor?: VoiceMissionSupervisor;
}

/**
 * Create or update a mission supervisor evaluation.
 * Pure function — computes health, detects risks, recommends action.
 */
export function evaluateVoiceMissionSupervisor(
  input: VoiceMissionSupervisionCreateInput,
): VoiceMissionSupervisor {
  const risks = detectMissionRisks(input);
  const healthScore = calculateMissionHealthScore(
    risks,
    input.graphProgress,
    input.graphStatus,
  );

  const supervisionStatus = determineSupervisionStatus(
    healthScore,
    risks,
  );

  const recommendedAction = determineRecommendedAction(
    supervisionStatus,
    risks,
  );

  // Track consecutive warnings
  const consecutiveWarnings =
    supervisionStatus !== "healthy"
      ? (input.previousSupervisor?.consecutiveWarnings ?? 0) + 1
      : 0;

  const supervisor: VoiceMissionSupervisor = {
    supervisorId: generateSupervisorId(),
    missionId: input.mission.missionId,
    graphId: input.graphId,
    supervisionStatus,
    missionHealthScore: healthScore,
    detectedRisks: risks,
    recommendedAction,
    evaluatedAt: Date.now(),
    evaluationSummary: `health=${healthScore}%, status=${supervisionStatus}, action=${recommendedAction}, risks=${risks.length}`,
    consecutiveWarnings,
    lastHealthyAt:
      supervisionStatus === "healthy"
        ? Date.now()
        : input.previousSupervisor?.lastHealthyAt,
  };

  const validationErrors = validateMissionSupervisor(supervisor);
  if (validationErrors.length > 0) {
    // Should never happen — fallback to safe defaults
    supervisor.supervisionStatus = "halting";
    supervisor.missionHealthScore = 0;
    supervisor.recommendedAction = "halt";
    supervisor.evaluationSummary += ` | Validation failed (${validationErrors.join(", ")}), fallback to safe defaults`;
  }

  return supervisor;
}

// ============================================================================
// Supervisor singleton (current evaluation)
// ============================================================================

let _currentSupervisor: VoiceMissionSupervisor | null = null;

export function getCurrentSupervisor(): VoiceMissionSupervisor | null {
  return _currentSupervisor ? { ..._currentSupervisor } : null;
}

export function setCurrentSupervisor(supervisor: VoiceMissionSupervisor): void {
  _currentSupervisor = supervisor;
}

export function clearCurrentSupervisor(): void {
  _currentSupervisor = null;
}

export function setSupervisorForTest(
  supervisor: VoiceMissionSupervisor | null,
): void {
  _currentSupervisor = supervisor;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceMissionSupervisor(
  supervisor: VoiceMissionSupervisor,
): string {
  const statusEmoji: Record<VoiceMissionSupervisionStatus, string> = {
    healthy: "🟢",
    watching: "🟡",
    intervening: "🟠",
    halting: "🔴",
  };

  const actionEmoji: Record<VoiceMissionRecommendedAction, string> = {
    continue: "▶️",
    pause: "⏸️",
    replan: "🔄",
    halt: "🛑",
  };

  const lines = [
    `🛡️ Voice Mission Supervisor`,
    `• supervisor ID: ${supervisor.supervisorId}`,
    `• mission ID: ${supervisor.missionId}`,
    `• graph ID: ${supervisor.graphId}`,
    `• status: ${statusEmoji[supervisor.supervisionStatus]} ${supervisor.supervisionStatus}`,
    `• health score: ${supervisor.missionHealthScore}%`,
    `• recommended action: ${actionEmoji[supervisor.recommendedAction]} ${supervisor.recommendedAction}`,
    `• evaluation: ${supervisor.evaluationSummary}`,
    `• consecutive warnings: ${supervisor.consecutiveWarnings}`,
    `• evaluated at: ${new Date(supervisor.evaluatedAt).toISOString()}`,
  ];

  if (supervisor.lastHealthyAt) {
    lines.push(`• last healthy at: ${new Date(supervisor.lastHealthyAt).toISOString()}`);
  }

  if (supervisor.detectedRisks.length > 0) {
    lines.push(`--- Detected Risks (${supervisor.detectedRisks.length}) ---`);
    for (const risk of supervisor.detectedRisks) {
      const severityEmoji =
        risk.severity >= 80 ? "🔴" :
        risk.severity >= 60 ? "🟠" :
        risk.severity >= 40 ? "🟡" : "🟢";

      lines.push(
        `  ${severityEmoji} ${risk.type} (${risk.severity}%): ${risk.description}`,
      );
      if (risk.affectedNodeIds && risk.affectedNodeIds.length > 0) {
        lines.push(`    affected nodes: ${risk.affectedNodeIds.join(", ")}`);
      }
    }
  }

  return lines.join("\n");
}
