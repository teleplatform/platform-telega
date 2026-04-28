/**
 * Voice Dual-Core Shadow Validation Layer v9.8
 *
 * First-class entity: VoiceDualCoreValidation
 *
 * This layer answers:
 *   - "Do old and new core versions produce equivalent results?"
 *   - "What is the divergence between parallel execution paths?"
 *   - "Is it safe to cut over to the new version?"
 *
 * This layer does NOT:
 *   - create snapshots (delegated to V9.4)
 *   - manage migrations (delegated to V9.6)
 *
 * RULE: NO GENERATIONAL CUTOVER WITHOUT SHADOW VALIDATION
 */

import type { VoiceCoreMigration } from "./voiceMigrationGovernor.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceValidationResult =
  | "equivalent"
  | "acceptable_delta"
  | "mismatch"
  | "critical_divergence";

export type VoiceValidationStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type VoiceTestScenario = {
  scenarioId: string;
  description: string;
  input: Record<string, unknown>;
  expectedResult?: Record<string, unknown>;
};

export interface VoiceScenarioComparison {
  scenarioId: string;
  oldCoreResult: Record<string, unknown>;
  newCoreResult: Record<string, unknown>;
  match: boolean;
  deltaScore: number; // 0..100 (0 = identical, 100 = completely different)
  divergenceReason?: string;
}

export interface VoiceDualCoreValidation {
  validationId: string;

  migrationId?: string;

  oldVersion: string;
  newVersion: string;

  scenarios: VoiceTestScenario[];
  comparisons: VoiceScenarioComparison[];

  result: VoiceValidationResult;
  status: VoiceValidationStatus;

  // Statistics
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  passRate: number; // 0..100

  // Divergence analysis
  maxDeltaScore: number;
  avgDeltaScore: number;

  criticalDivergences: Array<{
    scenarioId: string;
    reason: string;
    severity: number;
  }>;

  startedAt?: number;
  completedAt?: number;
  createdAt: number;
}

export type VoiceValidationValidationError =
  | "no_scenarios"
  | "invalid_result"
  | "invalid_status"
  | "pass_rate_out_of_range";

// ============================================================================
// ID generation
// ============================================================================

function generateValidationId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_val_${timestamp}_${random}`;
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

const VALID_RESULTS: VoiceValidationResult[] = [
  "equivalent",
  "acceptable_delta",
  "mismatch",
  "critical_divergence",
];

const VALID_STATUSES: VoiceValidationStatus[] = [
  "pending",
  "running",
  "completed",
  "failed",
];

export function validateDualCoreValidation(
  validation: Partial<VoiceDualCoreValidation>,
): VoiceValidationValidationError[] {
  const errors: VoiceValidationValidationError[] = [];

  if (validation.scenarios && validation.scenarios.length === 0) {
    errors.push("no_scenarios");
  }

  if (validation.result && !VALID_RESULTS.includes(validation.result)) {
    errors.push("invalid_result");
  }

  if (validation.status && !VALID_STATUSES.includes(validation.status)) {
    errors.push("invalid_status");
  }

  if (
    validation.passRate !== undefined &&
    (validation.passRate < 0 || validation.passRate > 100)
  ) {
    errors.push("pass_rate_out_of_range");
  }

  return errors;
}

// ============================================================================
// Validation execution
// ============================================================================

export interface VoiceDualCoreValidationInput {
  migrationId?: string;
  oldVersion: string;
  newVersion: string;
  scenarios: VoiceTestScenario[];
}

/**
 * Create and execute dual-core shadow validation.
 * Pure function — simulates parallel execution and compares results.
 */
export async function executeDualCoreValidation(
  input: VoiceDualCoreValidationInput,
  // Callbacks to actually run against both cores
  runOnOldCore: (
    scenario: VoiceTestScenario,
  ) => Promise<Record<string, unknown>>,
  runOnNewCore: (
    scenario: VoiceTestScenario,
  ) => Promise<Record<string, unknown>>,
): Promise<{
  validation: VoiceDualCoreValidation;
  validationErrors: VoiceValidationValidationError[];
}> {
  const validation: VoiceDualCoreValidation = {
    validationId: generateValidationId(),
    migrationId: input.migrationId,
    oldVersion: input.oldVersion,
    newVersion: input.newVersion,
    scenarios: input.scenarios,
    comparisons: [],
    result: "equivalent",
    status: "running",
    totalScenarios: input.scenarios.length,
    passedScenarios: 0,
    failedScenarios: 0,
    passRate: 0,
    maxDeltaScore: 0,
    avgDeltaScore: 0,
    criticalDivergences: [],
    createdAt: Date.now(),
    startedAt: Date.now(),
  };

  // Execute scenarios in parallel
  const comparisons: VoiceScenarioComparison[] = [];
  const criticalDivergences: VoiceDualCoreValidation["criticalDivergences"] = [];
  let passedCount = 0;
  let failedCount = 0;
  const deltaScores: number[] = [];

  for (const scenario of input.scenarios) {
    const oldResult = await runOnOldCore(scenario);
    const newResult = await runOnNewCore(scenario);

    const { match, deltaScore, reason } = compareResults(
      oldResult,
      newResult,
    );

    const comparison: VoiceScenarioComparison = {
      scenarioId: scenario.scenarioId,
      oldCoreResult: oldResult,
      newCoreResult: newResult,
      match,
      deltaScore,
      divergenceReason: reason,
    };

    comparisons.push(comparison);
    deltaScores.push(deltaScore);

    if (match) {
      passedCount++;
    } else {
      failedCount++;
    }

    // Track critical divergences
    if (deltaScore >= 80) {
      criticalDivergences.push({
        scenarioId: scenario.scenarioId,
        reason: reason ?? "High divergence detected",
        severity: deltaScore,
      });
    }
  }

  // Determine overall result
  const passRate =
    input.scenarios.length > 0
      ? Math.round((passedCount / input.scenarios.length) * 100)
      : 0;
  const avgDelta =
    deltaScores.length > 0
      ? Math.round(
          deltaScores.reduce((sum, d) => sum + d, 0) / deltaScores.length,
        )
      : 0;
  const maxDelta = deltaScores.length > 0 ? Math.max(...deltaScores) : 0;

  const result = determineValidationResult(
    passRate,
    avgDelta,
    maxDelta,
    criticalDivergences.length,
  );

  validation.comparisons = comparisons;
  validation.result = result;
  validation.status = "completed";
  validation.passedScenarios = passedCount;
  validation.failedScenarios = failedCount;
  validation.passRate = passRate;
  validation.maxDeltaScore = maxDelta;
  validation.avgDeltaScore = avgDelta;
  validation.criticalDivergences = criticalDivergences;
  validation.completedAt = Date.now();

  const validationErrors = validateDualCoreValidation(validation);

  return { validation, validationErrors };
}

// ============================================================================
// Result comparison logic
// ============================================================================

function compareResults(
  oldResult: Record<string, unknown>,
  newResult: Record<string, unknown>,
): {
  match: boolean;
  deltaScore: number;
  reason?: string;
} {
  // Deep equality check
  const isEqual = JSON.stringify(oldResult) === JSON.stringify(newResult);
  if (isEqual) {
    return { match: true, deltaScore: 0 };
  }

  // Calculate structural delta
  const oldKeys = new Set(Object.keys(oldResult));
  const newKeys = new Set(Object.keys(newResult));

  const addedKeys = [...newKeys].filter((k) => !oldKeys.has(k));
  const removedKeys = [...oldKeys].filter((k) => !newKeys.has(k));
  const sharedKeys = [...newKeys].filter((k) => oldKeys.has(k));

  // Count value differences in shared keys
  let valueDiffs = 0;
  for (const key of sharedKeys) {
    if (JSON.stringify(oldResult[key]) !== JSON.stringify(newResult[key])) {
      valueDiffs++;
    }
  }

  const totalKeys = new Set([...oldKeys, ...newKeys]).size;
  const diffRatio =
    totalKeys > 0
      ? (addedKeys.length + removedKeys.length + valueDiffs) / totalKeys
      : 1;

  const deltaScore = Math.round(Math.min(100, diffRatio * 100));

  // Determine match status
  if (deltaScore <= 5) {
    return { match: true, deltaScore, reason: "Negligible delta (< 5%)" };
  }

  if (deltaScore <= 20) {
    return {
      match: true,
      deltaScore,
      reason: "Acceptable delta (≤ 20%)",
    };
  }

  if (deltaScore <= 50) {
    return {
      match: false,
      deltaScore,
      reason: `Mismatch: ${addedKeys.length} added, ${removedKeys.length} removed, ${valueDiffs} changed`,
    };
  }

  return {
    match: false,
    deltaScore,
    reason: `Critical divergence: ${deltaScore}% difference`,
  };
}

function determineValidationResult(
  passRate: number,
  avgDelta: number,
  maxDelta: number,
  criticalCount: number,
): VoiceValidationResult {
  // Critical divergence: immediate fail
  if (criticalCount > 0 || maxDelta >= 80) {
    return "critical_divergence";
  }

  // High mismatch rate
  if (passRate < 50) {
    return "critical_divergence";
  }

  // Moderate mismatch
  if (passRate < 80 || avgDelta > 30) {
    return "mismatch";
  }

  // Acceptable delta
  if (passRate < 95 || avgDelta > 10) {
    return "acceptable_delta";
  }

  // Equivalent
  return "equivalent";
}

// ============================================================================
// Validation registry
// ============================================================================

export interface VoiceValidationRegistry {
  validations: Map<string, VoiceDualCoreValidation>;
  maxValidations: number;
}

const DEFAULT_VALIDATION_MAX = 50;

let _validationRegistry: VoiceValidationRegistry = {
  validations: new Map(),
  maxValidations: DEFAULT_VALIDATION_MAX,
};

export function registerValidation(
  validation: VoiceDualCoreValidation,
): void {
  if (_validationRegistry.validations.size >= _validationRegistry.maxValidations) {
    throw new Error(
      `Validation registry full (max ${_validationRegistry.maxValidations}). Cannot register ${validation.validationId}`,
    );
  }
  _validationRegistry.validations.set(validation.validationId, validation);
}

export function getValidation(
  validationId: string,
): VoiceDualCoreValidation | undefined {
  return _validationRegistry.validations.get(validationId);
}

export function getValidationsForMigration(
  migrationId: string,
): VoiceDualCoreValidation[] {
  return Array.from(_validationRegistry.validations.values()).filter(
    (v) => v.migrationId === migrationId,
  );
}

export function getSuccessfulValidations(): VoiceDualCoreValidation[] {
  return Array.from(_validationRegistry.validations.values()).filter(
    (v) =>
      v.result === "equivalent" || v.result === "acceptable_delta",
  );
}

export function getFailedValidations(): VoiceDualCoreValidation[] {
  return Array.from(_validationRegistry.validations.values()).filter(
    (v) =>
      v.result === "mismatch" || v.result === "critical_divergence",
  );
}

export function getAllValidations(): VoiceDualCoreValidation[] {
  return Array.from(_validationRegistry.validations.values())
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function removeValidation(validationId: string): boolean {
  return _validationRegistry.validations.delete(validationId);
}

export function clearValidationRegistry(): void {
  _validationRegistry = {
    validations: new Map(),
    maxValidations: DEFAULT_VALIDATION_MAX,
  };
}

export function setValidationRegistryForTest(
  registry: VoiceValidationRegistry,
): void {
  _validationRegistry = registry;
}

// ============================================================================
// Cutover gate
// ============================================================================

/**
 * Check if cutover is allowed based on validation results.
 * RULE: NO GENERATIONAL CUTOVER WITHOUT SHADOW VALIDATION
 */
export function canCutOver(
  validation: VoiceDualCoreValidation,
  options?: { minPassRate?: number; allowAcceptableDelta?: boolean },
): { allowed: boolean; reason: string; blockers: string[] } {
  const minPassRate = options?.minPassRate ?? 80;
  const allowDelta = options?.allowAcceptableDelta ?? true;

  const blockers: string[] = [];

  if (validation.status !== "completed") {
    blockers.push(
      `Validation not completed: status is "${validation.status}"`,
    );
  }

  if (validation.passRate < minPassRate) {
    blockers.push(
      `Pass rate ${validation.passRate}% below threshold ${minPassRate}%`,
    );
  }

  if (validation.result === "critical_divergence") {
    blockers.push(
      `Critical divergence detected: ${validation.criticalDivergences.length} scenarios diverged critically`,
    );
  }

  if (
    validation.result === "mismatch" &&
    !allowDelta
  ) {
    blockers.push(
      `Validation result is "mismatch". Cutover not allowed without addressing mismatches.`,
    );
  }

  if (validation.maxDeltaScore >= 80) {
    blockers.push(
      `Max delta score ${validation.maxDeltaScore}% exceeds safe threshold 80%`,
    );
  }

  return {
    allowed: blockers.length === 0,
    reason:
      blockers.length === 0
        ? `Shadow validation passed: ${validation.passRate}% pass rate, result=${validation.result}`
        : `Cutover blocked: ${blockers.join("; ")}`,
    blockers,
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceDualCoreValidation(
  validation: VoiceDualCoreValidation,
): string {
  const resultEmoji: Record<VoiceValidationResult, string> = {
    equivalent: "✅",
    acceptable_delta: "🟡",
    mismatch: "🟠",
    critical_divergence: "🔴",
  };

  const statusEmoji: Record<VoiceValidationStatus, string> = {
    pending: "⏸️",
    running: "▶️",
    completed: "🏁",
    failed: "❌",
  };

  const lines = [
    `🔀 Voice Dual-Core Shadow Validation`,
    `• validation ID: ${validation.validationId}`,
    validation.migrationId
      ? `• migration ID: ${validation.migrationId}`
      : null,
    `• old version: ${validation.oldVersion} → new version: ${validation.newVersion}`,
    `• result: ${resultEmoji[validation.result]} ${validation.result}`,
    `• status: ${statusEmoji[validation.status]} ${validation.status}`,
    `--- Statistics ---`,
    `  • total scenarios: ${validation.totalScenarios}`,
    `  • passed: ${validation.passedScenarios}`,
    `  • failed: ${validation.failedScenarios}`,
    `  • pass rate: ${validation.passRate}%`,
    `  • avg delta: ${validation.avgDeltaScore}%`,
    `  • max delta: ${validation.maxDeltaScore}%`,
  ];

  if (validation.criticalDivergences.length > 0) {
    lines.push(
      `--- Critical Divergences (${validation.criticalDivergences.length}) ---`,
    );
    for (const div of validation.criticalDivergences.slice(0, 5)) {
      lines.push(
        `  🔴 ${div.scenarioId}: severity=${div.severity} — ${div.reason}`,
      );
    }
  }

  lines.push(
    `• started at: ${validation.startedAt ? new Date(validation.startedAt).toISOString() : "N/A"}`,
  );
  lines.push(
    `• completed at: ${validation.completedAt ? new Date(validation.completedAt).toISOString() : "N/A"}`,
  );

  return lines.filter(Boolean).join("\n");
}
