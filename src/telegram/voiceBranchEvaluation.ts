/**
 * Voice Branch Evaluation & Multi-Path Mission Choice Layer v8.4
 *
 * First-class entity: VoiceMissionBranchEvaluation
 *
 * This layer answers:
 *   - "When multiple execution paths exist, which is the best choice?"
 *   - "How do branches compare across stability, risk, cost, and mission fit?"
 *   - "What selection reason justifies the chosen branch?"
 *
 * This layer does NOT:
 *   - replan the mission (delegated to V8.2)
 *   - contain failures (delegated to V8.3)
 *   - build the initial graph (delegated to V8.0)
 *
 * RULE: NO HIGH-IMPACT MISSION EXECUTION WITHOUT BRANCH COMPARISON WHEN MULTIPLE SAFE PATHS EXIST
 */

import type { VoiceMissionExecutionGraph } from "./voiceMissionExecutionGraph.js";
import type { VoiceEnvironmentType } from "./voiceEnvironmentContext.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceBranchSelectionReason =
  | "lowest_risk"
  | "highest_fit"
  | "best_balance"
  | "fastest_safe_path";

export interface VoiceMissionBranch {
  branchId: string;
  graphId: string;

  estimatedStability: number; // 0..100
  estimatedRisk: number; // 0..100
  estimatedCost: number; // 0..100
  estimatedMissionFit: number; // 0..100
}

export interface VoiceMissionBranchEvaluation {
  evaluationId: string;

  missionId: string;

  branches: VoiceMissionBranch[];

  selectedBranchId: string;

  selectionReason: VoiceBranchSelectionReason;

  evaluatedAt: number;

  // Metadata
  evaluationSummary: string;
  branchScores: Array<{
    branchId: string;
    compositeScore: number;
    rank: number;
  }>;
}

export type VoiceMissionBranchEvaluationValidationError =
  | "no_branches"
  | "duplicate_branch_ids"
  | "stability_out_of_range"
  | "risk_out_of_range"
  | "cost_out_of_range"
  | "mission_fit_out_of_range"
  | "selected_branch_not_in_list"
  | "missing_mission_id";

// ============================================================================
// ID generation
// ============================================================================

function generateEvaluationId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_branch_eval_${timestamp}_${random}`;
}

function generateBranchId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(2);
  return `branch_${timestamp}_${random}`;
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

export function validateBranchEvaluation(
  evaluation: Partial<VoiceMissionBranchEvaluation>,
): VoiceMissionBranchEvaluationValidationError[] {
  const errors: VoiceMissionBranchEvaluationValidationError[] = [];

  if (!evaluation.missionId || evaluation.missionId.trim().length === 0) {
    errors.push("missing_mission_id");
  }

  if (!evaluation.branches || evaluation.branches.length === 0) {
    errors.push("no_branches");
    return errors;
  }

  // Check for duplicate branch IDs
  const branchIds = evaluation.branches.map((b) => b.branchId);
  if (new Set(branchIds).size !== branchIds.length) {
    errors.push("duplicate_branch_ids");
  }

  // Check branch metrics
  for (const branch of evaluation.branches) {
    if (branch.estimatedStability < 0 || branch.estimatedStability > 100) {
      errors.push("stability_out_of_range");
      break;
    }
    if (branch.estimatedRisk < 0 || branch.estimatedRisk > 100) {
      errors.push("risk_out_of_range");
      break;
    }
    if (branch.estimatedCost < 0 || branch.estimatedCost > 100) {
      errors.push("cost_out_of_range");
      break;
    }
    if (branch.estimatedMissionFit < 0 || branch.estimatedMissionFit > 100) {
      errors.push("mission_fit_out_of_range");
      break;
    }
  }

  // Check selected branch is in list
  if (
    evaluation.selectedBranchId &&
    !branchIds.includes(evaluation.selectedBranchId)
  ) {
    errors.push("selected_branch_not_in_list");
  }

  return errors;
}

// ============================================================================
// Branch scoring
// ============================================================================

/**
 * Calculate composite score for a branch.
 * Weights depend on the context (environment type).
 */
export function calculateBranchCompositeScore(
  branch: VoiceMissionBranch,
  environmentType: VoiceEnvironmentType,
): number {
  // Determine weights based on environment
  const weights = getBranchWeights(environmentType);

  // Composite = weighted sum (risk is inverted — lower is better)
  const stabilityScore = branch.estimatedStability * weights.stability;
  const riskScore = (100 - branch.estimatedRisk) * weights.risk;
  const costScore = (100 - branch.estimatedCost) * weights.cost;
  const fitScore = branch.estimatedMissionFit * weights.missionFit;

  return Math.round(stabilityScore + riskScore + costScore + fitScore);
}

/**
 * Get branch scoring weights for each environment type.
 */
function getBranchWeights(
  environmentType: VoiceEnvironmentType,
): {
  stability: number;
  risk: number;
  cost: number;
  missionFit: number;
} {
  switch (environmentType) {
    case "crisis":
      // Crisis: prioritize stability and risk avoidance above all
      return { stability: 0.35, risk: 0.35, cost: 0.05, missionFit: 0.25 };

    case "stabilization":
      // Stabilization: focus on stability and mission fit
      return { stability: 0.3, risk: 0.25, cost: 0.1, missionFit: 0.35 };

    case "production":
      // Production: balanced approach with slight risk preference
      return { stability: 0.25, risk: 0.25, cost: 0.2, missionFit: 0.3 };

    case "growth":
      // Growth: prioritize mission fit and accept moderate risk
      return { stability: 0.2, risk: 0.15, cost: 0.15, missionFit: 0.5 };

    case "testing":
      // Testing: prioritize mission fit and cost (speed of learning)
      return { stability: 0.1, risk: 0.1, cost: 0.3, missionFit: 0.5 };
  }
}

// ============================================================================
// Branch selection logic
// ============================================================================

/**
 * Select the best branch based on scores and context.
 * Pure function — deterministic given the same inputs.
 */
export function selectBestBranch(
  branches: VoiceMissionBranch[],
  environmentType: VoiceEnvironmentType,
): {
  selectedBranchId: string;
  selectionReason: VoiceBranchSelectionReason;
} {
  if (branches.length === 0) {
    throw new Error("Cannot select branch from empty list");
  }

  if (branches.length === 1) {
    return {
      selectedBranchId: branches[0].branchId,
      selectionReason: "highest_fit",
    };
  }

  // Calculate composite scores
  const scoredBranches = branches.map((branch) => ({
    branch,
    score: calculateBranchCompositeScore(branch, environmentType),
  }));

  // Sort by score descending
  scoredBranches.sort((a, b) => b.score - a.score);

  const best = scoredBranches[0];

  // Determine selection reason
  const selectionReason = determineSelectionReason(
    best.branch,
    scoredBranches,
    environmentType,
  );

  return {
    selectedBranchId: best.branch.branchId,
    selectionReason,
  };
}

/**
 * Determine why a branch was selected.
 */
function determineSelectionReason(
  selected: VoiceMissionBranch,
  allScored: Array<{ branch: VoiceMissionBranch; score: number }>,
  environmentType: VoiceEnvironmentType,
): VoiceBranchSelectionReason {
  // Check if lowest risk was the deciding factor
  const lowestRisk = Math.min(...allScored.map((s) => s.branch.estimatedRisk));
  if (selected.estimatedRisk === lowestRisk && lowestRisk < 20) {
    return "lowest_risk";
  }

  // Check if mission fit was the deciding factor
  const highestFit = Math.max(...allScored.map((s) => s.branch.estimatedMissionFit));
  if (selected.estimatedMissionFit === highestFit && highestFit > 80) {
    return "highest_fit";
  }

  // Check if this is the fastest path with acceptable risk
  const lowestCost = Math.min(...allScored.map((s) => s.branch.estimatedCost));
  if (
    selected.estimatedCost === lowestCost &&
    selected.estimatedRisk < 40
  ) {
    return "fastest_safe_path";
  }

  // Default: best overall balance
  return "best_balance";
}

// ============================================================================
// Branch estimation from graph
// ============================================================================

export interface VoiceBranchEstimationInput {
  missionId: string;
  graphs: VoiceMissionExecutionGraph[];
  domainHealthScores: Record<string, number>;
}

/**
 * Estimate branch scores from execution graphs.
 * Pure function — derives estimates from graph properties.
 */
export function estimateBranchesFromGraphs(
  input: VoiceBranchEstimationInput,
): VoiceMissionBranch[] {
  return input.graphs.map((graph) => {
    // Stability: based on node completion rate and lack of failures
    const totalNodes = graph.nodes.length;
    const completedNodes = graph.nodes.filter(
      (n) => n.status === "completed" || n.status === "skipped",
    ).length;
    const failedNodes = graph.nodes.filter((n) => n.status === "failed").length;

    const completionRate = totalNodes > 0 ? completedNodes / totalNodes : 0;
    const failureRate = totalNodes > 0 ? failedNodes / totalNodes : 0;
    const estimatedStability = Math.round(
      (completionRate * 70) + ((1 - failureRate) * 30),
    );

    // Risk: based on failed nodes and domain health
    const failedNodeDomains = graph.nodes
      .filter((n) => n.status === "failed")
      .map((n) => n.domainId);

    const avgDomainHealth =
      failedNodeDomains.length > 0
        ? failedNodeDomains.reduce(
            (sum, d) => sum + (input.domainHealthScores[d] ?? 50),
            0,
          ) / failedNodeDomains.length
        : 80;

    const estimatedRisk = Math.round(
      (failureRate * 50) + ((100 - avgDomainHealth) / 2),
    );

    // Cost: based on node count and estimated durations
    const totalEstimatedDuration = graph.nodes.reduce(
      (sum, n) => sum + (n.estimatedDurationMs ?? 5000),
      0,
    );
    // Normalize to 0..100 (assume 60 seconds = 100% cost)
    const estimatedCost = Math.min(
      100,
      Math.round((totalEstimatedDuration / 60000) * 100),
    );

    // Mission fit: based on graph status and progress
    const statusBonus =
      graph.graphStatus === "completed" ? 40 :
      graph.graphStatus === "running" ? 20 :
      graph.graphStatus === "ready" ? 15 : 5;

    const progressBonus = totalNodes > 0
      ? Math.round((completedNodes / totalNodes) * 40)
      : 0;

    const estimatedMissionFit = Math.min(100, statusBonus + progressBonus + 20);

    return {
      branchId: generateBranchId(),
      graphId: graph.graphId,
      estimatedStability,
      estimatedRisk,
      estimatedCost,
      estimatedMissionFit,
    };
  });
}

// ============================================================================
// Core evaluation creation
// ============================================================================

export interface VoiceMissionBranchEvaluationInput {
  missionId: string;
  branches: VoiceMissionBranch[];
  environmentType: VoiceEnvironmentType;
}

/**
 * Create a branch evaluation and select the best branch.
 * Pure function — scores all branches and selects the best.
 */
export function createVoiceMissionBranchEvaluation(
  input: VoiceMissionBranchEvaluationInput,
): {
  evaluation: VoiceMissionBranchEvaluation;
  validationErrors: VoiceMissionBranchEvaluationValidationError[];
} {
  // Calculate composite scores for ranking
  const branchScores = input.branches
    .map((branch) => ({
      branchId: branch.branchId,
      compositeScore: calculateBranchCompositeScore(
        branch,
        input.environmentType,
      ),
    }))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  // Add rank
  const rankedScores = branchScores.map((score, index) => ({
    ...score,
    rank: index + 1,
  }));

  // Select best branch
  const selection = selectBestBranch(input.branches, input.environmentType);

  const evaluation: VoiceMissionBranchEvaluation = {
    evaluationId: generateEvaluationId(),
    missionId: input.missionId,
    branches: input.branches,
    selectedBranchId: selection.selectedBranchId,
    selectionReason: selection.selectionReason,
    evaluatedAt: Date.now(),
    evaluationSummary: `Selected branch ${selection.selectedBranchId} (${selection.selectionReason}) from ${input.branches.length} branches`,
    branchScores: rankedScores,
  };

  const validationErrors = validateBranchEvaluation(evaluation);
  if (validationErrors.length > 0) {
    // Should never happen — fallback to first branch
    evaluation.selectedBranchId = input.branches[0].branchId;
    evaluation.selectionReason = "highest_fit";
    evaluation.evaluationSummary += ` | Validation failed (${validationErrors.join(", ")}), fallback to first branch`;
  }

  return { evaluation, validationErrors };
}

// ============================================================================
// Evaluation registry
// ============================================================================

export interface VoiceMissionBranchEvaluationRegistry {
  evaluations: Map<string, VoiceMissionBranchEvaluation>;
  maxEvaluations: number;
}

const DEFAULT_EVAL_MAX_REGISTRY = 50;

let _evalRegistry: VoiceMissionBranchEvaluationRegistry = {
  evaluations: new Map(),
  maxEvaluations: DEFAULT_EVAL_MAX_REGISTRY,
};

export function getVoiceMissionBranchEvaluationRegistry(): VoiceMissionBranchEvaluationRegistry {
  return {
    evaluations: new Map(_evalRegistry.evaluations),
    maxEvaluations: _evalRegistry.maxEvaluations,
  };
}

export function registerVoiceMissionBranchEvaluation(
  evaluation: VoiceMissionBranchEvaluation,
): void {
  if (_evalRegistry.evaluations.size >= _evalRegistry.maxEvaluations) {
    throw new Error(
      `Evaluation registry full (max ${_evalRegistry.maxEvaluations}). Cannot register ${evaluation.evaluationId}`,
    );
  }
  _evalRegistry.evaluations.set(evaluation.evaluationId, evaluation);
}

export function getVoiceMissionBranchEvaluation(
  evaluationId: string,
): VoiceMissionBranchEvaluation | undefined {
  return _evalRegistry.evaluations.get(evaluationId);
}

export function getEvaluationsForMission(
  missionId: string,
): VoiceMissionBranchEvaluation[] {
  return Array.from(_evalRegistry.evaluations.values()).filter(
    (e) => e.missionId === missionId,
  );
}

export function removeVoiceMissionBranchEvaluation(
  evaluationId: string,
): boolean {
  return _evalRegistry.evaluations.delete(evaluationId);
}

export function clearVoiceMissionBranchEvaluationRegistry(): void {
  _evalRegistry = {
    evaluations: new Map(),
    maxEvaluations: DEFAULT_EVAL_MAX_REGISTRY,
  };
}

export function setVoiceMissionBranchEvaluationRegistryForTest(
  registry: VoiceMissionBranchEvaluationRegistry,
): void {
  _evalRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceMissionBranchEvaluation(
  evaluation: VoiceMissionBranchEvaluation,
): string {
  const reasonEmoji: Record<VoiceBranchSelectionReason, string> = {
    lowest_risk: "🛡️",
    highest_fit: "🎯",
    best_balance: "⚖️",
    fastest_safe_path: "⚡",
  };

  const lines = [
    `📊 Voice Mission Branch Evaluation`,
    `• evaluation ID: ${evaluation.evaluationId}`,
    `• mission ID: ${evaluation.missionId}`,
    `• selected: ${evaluation.selectedBranchId}`,
    `• reason: ${reasonEmoji[evaluation.selectionReason]} ${evaluation.selectionReason}`,
    `• evaluated at: ${new Date(evaluation.evaluatedAt).toISOString()}`,
    `• summary: ${evaluation.evaluationSummary}`,
    `--- Branch Rankings (${evaluation.branches.length}) ---`,
  ];

  for (const score of evaluation.branchScores) {
    const branch = evaluation.branches.find((b) => b.branchId === score.branchId);
    if (branch) {
      const rankEmoji = score.rank === 1 ? "🥇" : score.rank === 2 ? "🥈" : score.rank === 3 ? "🥉" : `#${score.rank}`;
      const selected = score.branchId === evaluation.selectedBranchId ? " ✅ SELECTED" : "";
      lines.push(
        `  ${rankEmoji} ${branch.branchId}: score=${score.compositeScore} | stability=${branch.estimatedStability}% risk=${branch.estimatedRisk}% cost=${branch.estimatedCost}% fit=${branch.estimatedMissionFit}%${selected}`,
      );
    }
  }

  return lines.join("\n");
}

export function formatVoiceMissionBranchComparison(
  evaluation: VoiceMissionBranchEvaluation,
): string {
  const lines = [
    `📊 Voice Mission Branch Comparison`,
    ``,
    `Branch                | Stability | Risk     | Cost     | Fit      | Score  | Rank`,
    `--------------------- | --------- | -------- | -------- | -------- | ------ | ----`,
  ];

  for (const score of evaluation.branchScores) {
    const branch = evaluation.branches.find((b) => b.branchId === score.branchId);
    if (branch) {
      const selected = score.branchId === evaluation.selectedBranchId ? " ←" : "";
      lines.push(
        `${branch.branchId.padEnd(21)} | ${String(branch.estimatedStability).padStart(9)}% | ${String(branch.estimatedRisk).padStart(8)}% | ${String(branch.estimatedCost).padStart(8)}% | ${String(branch.estimatedMissionFit).padStart(8)}% | ${String(score.compositeScore).padStart(6)} | #${score.rank}${selected}`,
      );
    }
  }

  return lines.join("\n");
}
