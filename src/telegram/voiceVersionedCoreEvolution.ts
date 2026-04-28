/**
 * Voice Versioned Core Evolution — Integration Orchestrator v9.8
 *
 * Wires together V9.4–V9.8:
 *
 *   snapshot → diff → migration → compatibility → dual-core validation
 *
 * Layers:
 *   V9.4 — VoiceCoreSnapshot (version authority)
 *   V9.5 — VoiceCoreDiffEngine (semantic diff)
 *   V9.6 — VoiceMigrationGovernor (migration management)
 *   V9.7 — VoiceCompatibilityContract (invariant preservation)
 *   V9.8 — VoiceDualCoreValidation (shadow validation)
 *
 * Full pipeline:
 *   collective intelligence → governed core evolution (V8.8–V9.3)
 *   → snapshot versioning → diff analysis → migration → compatibility → validation
 */

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  VoiceCoreSnapshot,
  VoiceSnapshotStatus,
} from "./voiceCoreSnapshot.js";

export type {
  VoiceCoreDiff,
  VoiceDiffChangeType,
  VoiceDiffDomain,
  VoiceDiffChange,
} from "./voiceCoreDiffEngine.js";

export type {
  VoiceCoreMigration,
  VoiceMigrationMode,
  VoiceMigrationStatus,
  VoiceMigrationBlocker,
} from "./voiceMigrationGovernor.js";

export type {
  VoiceCoreCompatibilityContract,
  VoiceCoreInvariant,
  VoiceContractVerificationStatus,
  VoiceInvariantVerification,
} from "./voiceCompatibilityContract.js";

export type {
  VoiceDualCoreValidation,
  VoiceValidationResult,
  VoiceValidationStatus,
  VoiceScenarioComparison,
  VoiceTestScenario,
} from "./voiceDualCoreValidation.js";

// ============================================================================
// Core imports
// ============================================================================

import {
  createCoreSnapshot,
  promoteToCandidate,
  activateSnapshot,
  rollbackSnapshot,
  registerSnapshot,
  getActiveSnapshot,
  type VoiceCoreSnapshot,
  type VoiceCreateSnapshotInput,
} from "./voiceCoreSnapshot.js";

import {
  computeCoreDiff,
  registerDiff,
  canActivateSnapshot,
  type VoiceCoreDiff,
  type VoiceDiffComputationInput,
} from "./voiceCoreDiffEngine.js";

import {
  planCoreMigration,
  approveMigration,
  startMigration,
  completeMigration,
  failMigration,
  rollbackMigration,
  registerMigration,
  type VoiceCoreMigration,
  type VoiceMigrationPlanInput,
} from "./voiceMigrationGovernor.js";

import {
  createCompatibilityContract,
  verifyAllInvariants,
  canActivateWithContract,
  registerContract,
  type VoiceCoreCompatibilityContract,
  type VoiceCreateContractInput,
} from "./voiceCompatibilityContract.js";

import {
  canCutOver,
  registerValidation,
  type VoiceDualCoreValidation,
  type VoiceTestScenario,
} from "./voiceDualCoreValidation.js";

import type { VoiceCoreKnowledgePromotionDecision } from "./voiceCoreKnowledgePromotion.js";

// ============================================================================
// Integration types
// ============================================================================

/**
 * Full versioned core evolution result.
 */
export interface VoiceVersionedCoreEvolutionResult {
  // V9.4 — Snapshot
  snapshot: VoiceCoreSnapshot;

  // V9.5 — Diff (if parent exists)
  diff?: VoiceCoreDiff;
  canActivate: boolean;
  activationBlockers: string[];

  // V9.7 — Compatibility Contract
  contract: VoiceCoreCompatibilityContract;
  contractVerified: boolean;

  // V9.6 — Migration (if upgrading from active)
  migration?: VoiceCoreMigration;

  // V9.8 — Dual-Core Validation (if migration exists)
  validation?: VoiceDualCoreValidation;
  canCutOverToNew: boolean;
  cutoverBlockers: string[];

  // Overall status
  pipelineStatus:
    | "snapshot_created"
    | "diff_analyzed"
    | "migration_planned"
    | "contract_verified"
    | "validation_passed"
    | "blocked";
}

/**
 * Input for the full versioned core evolution pipeline.
 */
export interface VoiceVersionedCoreEvolutionInput {
  version: string;
  templates: Array<{ templateId: string; rank: number }>;
  federations: string[];
  promotionDecisionIds: string[];
  parentVersion?: string;
  description?: string;
  testScenarios?: VoiceTestScenario[];
}

// ============================================================================
// Integration pipeline
// ============================================================================

/**
 * Execute the full versioned core evolution pipeline.
 *
 * Pipeline flow:
 *   1. Create snapshot (V9.4)
 *   2. Compute diff against parent (V9.5)
 *   3. Check activation gate (V9.5)
 *   4. Create and verify compatibility contract (V9.7)
 *   5. Plan migration if parent exists (V9.6)
 *   6. Note: dual-core validation requires runtime callbacks
 */
export function runVersionedCoreEvolution(
  input: VoiceVersionedCoreEvolutionInput,
  // Optional: runtime callbacks for dual-core validation
  dualCoreCallbacks?: {
    runOnOldCore: (scenario: VoiceTestScenario) => Promise<Record<string, unknown>>;
    runOnNewCore: (scenario: VoiceTestScenario) => Promise<Record<string, unknown>>;
  },
): VoiceVersionedCoreEvolutionResult {
  // ─── Step 1: Create Snapshot (V9.4) ───
  const { snapshot, validationErrors: snapshotErrors } = createCoreSnapshot({
    version: input.version,
    templates: input.templates,
    federations: input.federations,
    promotionDecisionIds: input.promotionDecisionIds,
    parentVersion: input.parentVersion,
    description: input.description,
  });

  if (snapshotErrors.length > 0) {
    return {
      snapshot,
      canActivate: false,
      activationBlockers: [`Snapshot validation errors: ${snapshotErrors.join(", ")}`],
      contract: {} as VoiceCoreCompatibilityContract,
      contractVerified: false,
      canCutOverToNew: false,
      cutoverBlockers: ["Snapshot invalid"],
      pipelineStatus: "blocked",
    };
  }

  registerSnapshot(snapshot);

  let pipelineStatus: VoiceVersionedCoreEvolutionResult["pipelineStatus"] =
    "snapshot_created";

  // ─── Step 2: Compute Diff (V9.5) ───
  let diff: VoiceCoreDiff | undefined;
  let canActivate = true;
  let activationBlockers: string[] = [];

  if (input.parentVersion) {
    const parentSnapshot = getActiveSnapshot();
    if (parentSnapshot) {
      const diffInput: VoiceDiffComputationInput = {
        fromSnapshot: parentSnapshot,
        toSnapshot: snapshot,
      };

      const { diff: computedDiff } = computeCoreDiff(diffInput);
      diff = computedDiff;
      registerDiff(diff);

      // Check activation gate
      const activationCheck = canActivateSnapshot(diff);
      canActivate = activationCheck.allowed;
      activationBlockers = activationCheck.blockers;

      pipelineStatus = canActivate ? "diff_analyzed" : "blocked";
    }
  }

  // ─── Step 3: Create Compatibility Contract (V9.7) ───
  const contractInput: VoiceCreateContractInput = {
    snapshot,
  };

  const { contract } = createCompatibilityContract(contractInput);
  const verifiedContract = verifyAllInvariants(contract, "automated");
  registerContract(verifiedContract);

  // Check contract activation gate
  const contractCheck = canActivateWithContract(verifiedContract);
  if (!contractCheck.allowed) {
    canActivate = false;
    activationBlockers.push(...contractCheck.blockers);
  }

  pipelineStatus = canActivate
    ? "contract_verified"
    : "blocked";

  // ─── Step 4: Plan Migration (V9.6) ───
  let migration: VoiceCoreMigration | undefined;

  if (input.parentVersion && diff) {
    const parentSnapshot = getActiveSnapshot();
    if (parentSnapshot) {
      const { migration: plannedMigration } = planCoreMigration({
        fromSnapshot: parentSnapshot,
        toSnapshot: snapshot,
        diff,
      });

      registerMigration(plannedMigration);
      migration = plannedMigration;

      if (canActivate) {
        pipelineStatus = "migration_planned";
      }
    }
  }

  // ─── Step 5: Dual-Core Validation (V9.8) — async, only if callbacks provided ───
  let validation: VoiceDualCoreValidation | undefined;
  let canCutOverToNew = false;
  let cutoverBlockers: string[] = [];

  // Note: Dual-core validation requires runtime callbacks, handled separately
  // This pipeline creates the scaffolding but execution happens asynchronously

  return {
    snapshot,
    diff,
    canActivate,
    activationBlockers,
    contract: verifiedContract,
    contractVerified: verifiedContract.verified,
    migration,
    validation,
    canCutOverToNew,
    cutoverBlockers,
    pipelineStatus,
  };
}

// ============================================================================
// Async dual-core validation executor
// ============================================================================

/**
 * Execute dual-core validation for a planned migration.
 * This is the async part of the pipeline that requires runtime callbacks.
 */
export async function executeDualValidationForMigration(
  migration: VoiceCoreMigration,
  scenarios: VoiceTestScenario[],
  runOnOldCore: (
    scenario: VoiceTestScenario,
  ) => Promise<Record<string, unknown>>,
  runOnNewCore: (
    scenario: VoiceTestScenario,
  ) => Promise<Record<string, unknown>>,
): Promise<{
  validation: VoiceDualCoreValidation;
  canCutOver: boolean;
  cutoverBlockers: string[];
}> {
  const { executeDualCoreValidation } = await import(
    "./voiceDualCoreValidation.js"
  );

  const { validation } = await executeDualCoreValidation(
    {
      migrationId: migration.migrationId,
      oldVersion: migration.fromVersion,
      newVersion: migration.toVersion,
      scenarios,
    },
    runOnOldCore,
    runOnNewCore,
  );

  registerValidation(validation);

  const cutoverCheck = canCutOver(validation);

  return {
    validation,
    canCutOver: cutoverCheck.allowed,
    cutoverBlockers: cutoverCheck.blockers,
  };
}

import {
  getAllSnapshots,
  getSnapshotsByStatus,
} from "./voiceCoreSnapshot.js";
import {
  getAllDiffs,
  getHighRiskDiffs,
} from "./voiceCoreDiffEngine.js";
import {
  getAllMigrations,
  getCompletedMigrations,
  getFailedMigrations,
} from "./voiceMigrationGovernor.js";
import {
  getAllContracts,
  getVerifiedContracts,
} from "./voiceCompatibilityContract.js";
import {
  getAllValidations,
  getSuccessfulValidations,
  getFailedValidations,
} from "./voiceDualCoreValidation.js";

// ============================================================================
// Pipeline summary
// ============================================================================

export function buildVersionedCoreSummary(): {
  totalSnapshots: number;
  activeSnapshots: number;
  candidateSnapshots: number;
  totalDiffs: number;
  highRiskDiffs: number;
  totalMigrations: number;
  completedMigrations: number;
  failedMigrations: number;
  totalContracts: number;
  verifiedContracts: number;
  totalValidations: number;
  successfulValidations: number;
  failedValidations: number;
} {
  const allSnapshots = getAllSnapshots();
  const allDiffs = getAllDiffs();
  const allMigrations = getAllMigrations();
  const allContracts = getAllContracts();
  const allValidations = getAllValidations();

  return {
    totalSnapshots: allSnapshots.length,
    activeSnapshots: getSnapshotsByStatus("active").length,
    candidateSnapshots: getSnapshotsByStatus("candidate").length,
    totalDiffs: allDiffs.length,
    highRiskDiffs: getHighRiskDiffs().length,
    totalMigrations: allMigrations.length,
    completedMigrations: getCompletedMigrations().length,
    failedMigrations: getFailedMigrations().length,
    totalContracts: allContracts.length,
    verifiedContracts: getVerifiedContracts().length,
    totalValidations: allValidations.length,
    successfulValidations: getSuccessfulValidations().length,
    failedValidations: getFailedValidations().length,
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVersionedCoreSummary(): string {
  const summary = buildVersionedCoreSummary();

  const lines = [
    `📊 Voice Versioned Core Evolution — Summary`,
    ``,
    `Snapshots:`,
    `  • total: ${summary.totalSnapshots}`,
    `  • ✅ active: ${summary.activeSnapshots}`,
    `  • 🎯 candidate: ${summary.candidateSnapshots}`,
    ``,
    `Diffs:`,
    `  • total: ${summary.totalDiffs}`,
    `  • 🔴 high risk: ${summary.highRiskDiffs}`,
    ``,
    `Migrations:`,
    `  • total: ${summary.totalMigrations}`,
    `  • 🎉 completed: ${summary.completedMigrations}`,
    `  • ❌ failed: ${summary.failedMigrations}`,
    ``,
    `Contracts:`,
    `  • total: ${summary.totalContracts}`,
    `  • ✅ verified: ${summary.verifiedContracts}`,
    ``,
    `Validations:`,
    `  • total: ${summary.totalValidations}`,
    `  • ✅ successful: ${summary.successfulValidations}`,
    `  • ❌ failed: ${summary.failedValidations}`,
  ];

  return lines.join("\n");
}
