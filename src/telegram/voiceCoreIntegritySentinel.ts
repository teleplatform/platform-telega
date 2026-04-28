/**
 * Voice Core Integrity Sentinel — Governed Core Evolution Layer v9.3
 *
 * First-class entity: VoiceCoreKnowledgeIntegrityWatch
 *
 * This layer answers:
 *   - "Is deployed core knowledge still behaving correctly?"
 *   - "Are there regressions, context mismatches, or consistency violations?"
 *   - "Should this knowledge be kept, restricted, revalidated, or rolled back?"
 *
 * This layer does NOT:
 *   - admit knowledge to core (delegated to V9.1)
 *   - deploy knowledge to core (delegated to V9.2)
 *
 * RULE: NO CORE KNOWLEDGE MAY REMAIN ACTIVE IF CRITICAL INTEGRITY FAILURE IS CONFIRMED
 */

import type { VoiceDeploymentTargetType } from "./voiceCorePatternDeployment.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceIntegritySignalType =
  | "regression_detected"
  | "context_mismatch"
  | "goal_misalignment"
  | "consistency_violation"
  | "overgeneralization";

export type VoiceIntegrityWatchStatus =
  | "healthy"
  | "watching"
  | "degrading"
  | "critical";

export type VoiceIntegrityAction =
  | "keep"
  | "restrict_scope"
  | "revalidate"
  | "rollback_from_core";

export interface VoiceIntegritySignal {
  type: VoiceIntegritySignalType;
  severity: number; // 0..100
  source?: string;
  detectedAt?: number;
}

export interface VoiceCoreKnowledgeIntegrityWatch {
  watchId: string;

  deploymentId: string;
  templateId: string;

  integritySignals: VoiceIntegritySignal[];

  integrityScore: number; // 0..100 (higher = healthier)

  watchStatus: VoiceIntegrityWatchStatus;
  recommendedAction: VoiceIntegrityAction;

  // Trend analysis
  previousScore?: number;
  scoreDelta?: number; // positive = improving, negative = degrading

  // Metadata
  evaluatedAt: number;
}

export type VoiceIntegrityValidationError =
  | "invalid_deployment_id"
  | "invalid_template_id"
  | "no_integrity_signals"
  | "signal_severity_out_of_range"
  | "integrity_score_out_of_range"
  | "invalid_watch_status"
  | "invalid_recommended_action";

// ============================================================================
// ID generation
// ============================================================================

function generateWatchId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_watch_${timestamp}_${random}`;
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

const VALID_WATCH_STATUSES: VoiceIntegrityWatchStatus[] = [
  "healthy",
  "watching",
  "degrading",
  "critical",
];

const VALID_ACTIONS: VoiceIntegrityAction[] = [
  "keep",
  "restrict_scope",
  "revalidate",
  "rollback_from_core",
];

export function validateIntegrityWatch(
  watch: Partial<VoiceCoreKnowledgeIntegrityWatch>,
): VoiceIntegrityValidationError[] {
  const errors: VoiceIntegrityValidationError[] = [];

  if (!watch.deploymentId || watch.deploymentId.trim().length === 0) {
    errors.push("invalid_deployment_id");
  }

  if (!watch.templateId || watch.templateId.trim().length === 0) {
    errors.push("invalid_template_id");
  }

  if (watch.integritySignals && watch.integritySignals.length === 0) {
    errors.push("no_integrity_signals");
  }

  if (watch.integritySignals) {
    for (const signal of watch.integritySignals) {
      if (signal.severity < 0 || signal.severity > 100) {
        errors.push("signal_severity_out_of_range");
        break;
      }
    }
  }

  if (
    watch.integrityScore !== undefined &&
    (watch.integrityScore < 0 || watch.integrityScore > 100)
  ) {
    errors.push("integrity_score_out_of_range");
  }

  if (
    watch.watchStatus &&
    !VALID_WATCH_STATUSES.includes(watch.watchStatus)
  ) {
    errors.push("invalid_watch_status");
  }

  if (
    watch.recommendedAction &&
    !VALID_ACTIONS.includes(watch.recommendedAction)
  ) {
    errors.push("invalid_recommended_action");
  }

  return errors;
}

// ============================================================================
// Integrity evaluation
// ============================================================================

export interface VoiceIntegrityEvaluationInput {
  deploymentId: string;
  templateId: string;
  integritySignals: VoiceIntegritySignal[];
  previousScore?: number;
}

/**
 * Evaluate core knowledge integrity based on signals.
 * Pure function — determines watch status and recommended action.
 */
export function evaluateCoreIntegrity(
  input: VoiceIntegrityEvaluationInput,
): VoiceCoreKnowledgeIntegrityWatch {
  const { deploymentId, templateId, integritySignals, previousScore } = input;

  // Calculate integrity score from signals
  const maxSeverity = integritySignals.length
    ? Math.max(...integritySignals.map((s) => s.severity))
    : 0;

  const avgSeverity = integritySignals.length
    ? Math.round(
        integritySignals.reduce((sum, s) => sum + s.severity, 0) /
          integritySignals.length,
      )
    : 0;

  // Score: 100 = perfect health, 0 = critical failure
  // Weighted: max severity matters more than average
  const integrityScore = Math.max(
    0,
    Math.min(100, 100 - maxSeverity * 0.7 - avgSeverity * 0.3),
  );

  // Determine watch status
  const watchStatus: VoiceIntegrityWatchStatus = (() => {
    if (maxSeverity >= 85) return "critical";
    if (maxSeverity >= 65) return "degrading";
    if (maxSeverity >= 40) return "watching";
    return "healthy";
  })();

  // Determine recommended action
  const recommendedAction: VoiceIntegrityAction = (() => {
    if (maxSeverity >= 85) return "rollback_from_core";
    if (maxSeverity >= 65) return "revalidate";
    if (maxSeverity >= 40) return "restrict_scope";
    return "keep";
  })();

  // Calculate trend
  const scoreDelta =
    previousScore !== undefined
      ? integrityScore - previousScore
      : undefined;

  // Enrich signals with timestamps if not provided
  const enrichedSignals: VoiceIntegritySignal[] = integritySignals.map((s) => ({
    ...s,
    detectedAt: s.detectedAt ?? Date.now(),
  }));

  return {
    watchId: generateWatchId(),
    deploymentId,
    templateId,
    integritySignals: enrichedSignals,
    integrityScore: Math.round(integrityScore),
    watchStatus,
    recommendedAction,
    previousScore,
    scoreDelta,
    evaluatedAt: Date.now(),
  };
}

// ============================================================================
// Multi-signal integrity evaluation
// ============================================================================

export interface VoiceMultiSignalIntegrityInput {
  deploymentId: string;
  templateId: string;
  signals: VoiceIntegritySignal[];
  historyScores?: number[]; // previous scores for trend analysis
}

/**
 * Evaluate integrity with historical context for trend detection.
 */
export function evaluateCoreIntegrityWithHistory(
  input: VoiceMultiSignalIntegrityInput,
): VoiceCoreKnowledgeIntegrityWatch {
  const previousScore =
    input.historyScores && input.historyScores.length > 0
      ? input.historyScores[input.historyScores.length - 1]
      : undefined;

  return evaluateCoreIntegrity({
    deploymentId: input.deploymentId,
    templateId: input.templateId,
    integritySignals: input.signals,
    previousScore,
  });
}

// ============================================================================
// Signal classification helpers
// ============================================================================

/**
 * Classify the dominant signal type in a watch.
 */
export function classifyDominantSignalType(
  watch: VoiceCoreKnowledgeIntegrityWatch,
): VoiceIntegritySignalType | null {
  if (watch.integritySignals.length === 0) return null;

  // Group by type and sum severity
  const typeSeverity = new Map<VoiceIntegritySignalType, number>();
  for (const signal of watch.integritySignals) {
    const existing = typeSeverity.get(signal.type) ?? 0;
    typeSeverity.set(signal.type, existing + signal.severity);
  }

  let maxType: VoiceIntegritySignalType | null = null;
  let maxTotal = 0;
  for (const [type, total] of typeSeverity) {
    if (total > maxTotal) {
      maxTotal = total;
      maxType = type;
    }
  }

  return maxType;
}

/**
 * Check if a watch has any critical-level signals.
 */
export function hasCriticalSignals(
  watch: VoiceCoreKnowledgeIntegrityWatch,
): boolean {
  return watch.integritySignals.some((s) => s.severity >= 85);
}

/**
 * Check if a watch shows a degrading trend.
 */
export function isDegradingTrend(
  watch: VoiceCoreKnowledgeIntegrityWatch,
): boolean {
  if (watch.scoreDelta === undefined) return false;
  return watch.scoreDelta < -10; // degradation > 10 points
}

// ============================================================================
// Watch registry
// ============================================================================

export interface VoiceIntegrityWatchRegistry {
  watches: Map<string, VoiceCoreKnowledgeIntegrityWatch>;
  maxWatches: number;
}

const DEFAULT_WATCH_MAX = 200;

let _watchRegistry: VoiceIntegrityWatchRegistry = {
  watches: new Map(),
  maxWatches: DEFAULT_WATCH_MAX,
};

export function registerIntegrityWatch(
  watch: VoiceCoreKnowledgeIntegrityWatch,
): void {
  if (_watchRegistry.watches.size >= _watchRegistry.maxWatches) {
    throw new Error(
      `Integrity watch registry full (max ${_watchRegistry.maxWatches}). Cannot register ${watch.watchId}`,
    );
  }
  _watchRegistry.watches.set(watch.watchId, watch);
}

export function getIntegrityWatch(
  watchId: string,
): VoiceCoreKnowledgeIntegrityWatch | undefined {
  return _watchRegistry.watches.get(watchId);
}

export function getWatchesForDeployment(
  deploymentId: string,
): VoiceCoreKnowledgeIntegrityWatch[] {
  return Array.from(_watchRegistry.watches.values()).filter(
    (w) => w.deploymentId === deploymentId,
  );
}

export function getWatchesForTemplate(
  templateId: string,
): VoiceCoreKnowledgeIntegrityWatch[] {
  return Array.from(_watchRegistry.watches.values()).filter(
    (w) => w.templateId === templateId,
  );
}

export function getCriticalWatches(): VoiceCoreKnowledgeIntegrityWatch[] {
  return Array.from(_watchRegistry.watches.values()).filter(
    (w) => w.watchStatus === "critical",
  );
}

export function getDegradingWatches(): VoiceCoreKnowledgeIntegrityWatch[] {
  return Array.from(_watchRegistry.watches.values()).filter(
    (w) => w.watchStatus === "degrading",
  );
}

export function getWatchesRequiringAction(): VoiceCoreKnowledgeIntegrityWatch[] {
  return Array.from(_watchRegistry.watches.values()).filter(
    (w) => w.recommendedAction !== "keep",
  );
}

export function getAllIntegrityWatches(): VoiceCoreKnowledgeIntegrityWatch[] {
  return Array.from(_watchRegistry.watches.values());
}

export function removeIntegrityWatch(watchId: string): boolean {
  return _watchRegistry.watches.delete(watchId);
}

export function clearIntegrityWatchRegistry(): void {
  _watchRegistry = {
    watches: new Map(),
    maxWatches: DEFAULT_WATCH_MAX,
  };
}

export function setIntegrityWatchRegistryForTest(
  registry: VoiceIntegrityWatchRegistry,
): void {
  _watchRegistry = registry;
}

// ============================================================================
// Rollback enforcement
// ============================================================================

/**
 * Enforce rollback for critical integrity failures.
 * RULE: NO CORE KNOWLEDGE MAY REMAIN ACTIVE IF CRITICAL INTEGRITY FAILURE IS CONFIRMED
 */
export function enforceRollbackForCriticalFailure(
  watch: VoiceCoreKnowledgeIntegrityWatch,
): { shouldRollback: boolean; reason: string } {
  if (watch.watchStatus === "critical") {
    return {
      shouldRollback: true,
      reason: `Critical integrity failure confirmed: score=${watch.integrityScore}, signals=${watch.integritySignals.length}`,
    };
  }

  if (hasCriticalSignals(watch)) {
    return {
      shouldRollback: true,
      reason: `Critical signal detected: ${watch.integritySignals.filter((s) => s.severity >= 85).map((s) => s.type).join(", ")}`,
    };
  }

  return {
    shouldRollback: false,
    reason: "No critical integrity failure detected",
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceCoreKnowledgeIntegrityWatch(
  watch: VoiceCoreKnowledgeIntegrityWatch,
): string {
  const statusEmoji: Record<VoiceIntegrityWatchStatus, string> = {
    healthy: "🟢",
    watching: "👁️",
    degrading: "🟠",
    critical: "🔴",
  };

  const actionEmoji: Record<VoiceIntegrityAction, string> = {
    keep: "✅",
    restrict_scope: "⚠️",
    revalidate: "🔄",
    rollback_from_core: "↩️",
  };

  const signalEmoji: Record<VoiceIntegritySignalType, string> = {
    regression_detected: "📉",
    context_mismatch: "🔀",
    goal_misalignment: "🎯",
    consistency_violation: "⚡",
    overgeneralization: "🌊",
  };

  const lines = [
    `🛡️ Voice Core Knowledge Integrity Watch`,
    `• watch ID: ${watch.watchId}`,
    `• deployment ID: ${watch.deploymentId}`,
    `• template ID: ${watch.templateId}`,
    `• integrity score: ${watch.integrityScore}%`,
    `• status: ${statusEmoji[watch.watchStatus]} ${watch.watchStatus}`,
    `• recommended action: ${actionEmoji[watch.recommendedAction]} ${watch.recommendedAction}`,
    watch.previousScore !== undefined
      ? `• previous score: ${watch.previousScore}% (delta: ${watch.scoreDelta! > 0 ? "+" : ""}${watch.scoreDelta})`
      : null,
    `--- Integrity Signals (${watch.integritySignals.length}) ---`,
  ];

  for (const signal of watch.integritySignals.slice(0, 10)) {
    lines.push(
      `  ${signalEmoji[signal.type]} ${signal.type}: severity=${signal.severity}${signal.source ? ` (${signal.source})` : ""}`,
    );
  }

  if (watch.integritySignals.length > 10) {
    lines.push(`  ... and ${watch.integritySignals.length - 10} more`);
  }

  lines.push(`• evaluated at: ${new Date(watch.evaluatedAt).toISOString()}`);

  return lines.filter(Boolean).join("\n");
}

export function formatIntegritySummary(
  watches: VoiceCoreKnowledgeIntegrityWatch[],
): string {
  const total = watches.length;
  const healthy = watches.filter((w) => w.watchStatus === "healthy").length;
  const watching = watches.filter((w) => w.watchStatus === "watching").length;
  const degrading = watches.filter((w) => w.watchStatus === "degrading").length;
  const critical = watches.filter((w) => w.watchStatus === "critical").length;

  const rollbackRequired = watches.filter(
    (w) => w.recommendedAction === "rollback_from_core",
  ).length;

  const lines = [
    `🛡️ Core Integrity Summary`,
    `• total watches: ${total}`,
    `• 🟢 healthy: ${healthy}`,
    `• 👁️ watching: ${watching}`,
    `• 🟠 degrading: ${degrading}`,
    `• 🔴 critical: ${critical}`,
    `• ↩️ rollback required: ${rollbackRequired}`,
  ];

  return lines.join("\n");
}
