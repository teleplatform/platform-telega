/**
 * Voice Core Migration Governor v9.6
 *
 * First-class entity: VoiceCoreMigration
 *
 * This layer answers:
 *   - "How should the system transition between core versions?"
 *   - "What migration mode is appropriate for this version jump?"
 *   - "Are there blockers or compatibility risks?"
 *
 * This layer does NOT:
 *   - create snapshots (delegated to V9.4)
 *   - compute diffs (delegated to V9.5)
 *
 * RULE: NO GENERATIONAL CORE TRANSITION WITHOUT MIGRATION GOVERNOR APPROVAL
 */

import type { VoiceCoreSnapshot } from "./voiceCoreSnapshot.js";
import type { VoiceCoreDiff, VoiceDiffChangeType } from "./voiceCoreDiffEngine.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceMigrationMode =
  | "shadow"
  | "staged"
  | "dual_run"
  | "full_cutover";

export type VoiceMigrationStatus =
  | "planned"
  | "approved"
  | "running"
  | "completed"
  | "failed"
  | "rolled_back";

export type VoiceMigrationBlocker =
  | "breaking_change_without_dual_run"
  | "high_risk_without_review"
  | "incompatible_versions"
  | "rollback_path_missing"
  | "active_migration_exists";

export interface VoiceCoreMigration {
  migrationId: string;

  fromSnapshotId: string;
  toSnapshotId: string;

  fromVersion: string;
  toVersion: string;

  mode: VoiceMigrationMode;
  status: VoiceMigrationStatus;

  diffAnalysis?: {
    diffId: string;
    changeType: VoiceDiffChangeType;
    riskImpact: number;
  };

  blockers: VoiceMigrationBlocker[];

  approved: boolean;
  approvedBy?: string;
  approvedAt?: number;

  riskScore: number; // 0..100
  rollbackPath?: string; // version to rollback to

  plannedAt: number;
  startedAt?: number;
  completedAt?: number;
  failedReason?: string;
}

export type VoiceMigrationValidationError =
  | "same_version_migration"
  | "invalid_mode"
  | "invalid_status"
  | "risk_score_out_of_range"
  | "blocking_change_not_addressed";

// ============================================================================
// ID generation
// ============================================================================

function generateMigrationId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_mig_${timestamp}_${random}`;
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

const VALID_MODES: VoiceMigrationMode[] = [
  "shadow",
  "staged",
  "dual_run",
  "full_cutover",
];

const VALID_STATUSES: VoiceMigrationStatus[] = [
  "planned",
  "approved",
  "running",
  "completed",
  "failed",
  "rolled_back",
];

export function validateMigration(
  migration: Partial<VoiceCoreMigration>,
): VoiceMigrationValidationError[] {
  const errors: VoiceMigrationValidationError[] = [];

  if (
    migration.fromVersion &&
    migration.toVersion &&
    migration.fromVersion === migration.toVersion
  ) {
    errors.push("same_version_migration");
  }

  if (migration.mode && !VALID_MODES.includes(migration.mode)) {
    errors.push("invalid_mode");
  }

  if (migration.status && !VALID_STATUSES.includes(migration.status)) {
    errors.push("invalid_status");
  }

  if (
    migration.riskScore !== undefined &&
    (migration.riskScore < 0 || migration.riskScore > 100)
  ) {
    errors.push("risk_score_out_of_range");
  }

  return errors;
}

// ============================================================================
// Migration planning
// ============================================================================

export interface VoiceMigrationPlanInput {
  fromSnapshot: VoiceCoreSnapshot;
  toSnapshot: VoiceCoreSnapshot;
  diff?: VoiceCoreDiff;
}

/**
 * Plan a migration between two core snapshots.
 * Pure function — determines appropriate migration mode based on diff analysis.
 */
export function planCoreMigration(
  input: VoiceMigrationPlanInput,
): {
  migration: VoiceCoreMigration;
  validationErrors: VoiceMigrationValidationError[];
  blockers: VoiceMigrationBlocker[];
} {
  const { fromSnapshot, toSnapshot, diff } = input;

  // ─── Determine migration mode based on diff ───
  const changeType = diff?.changeType ?? "minor";
  const riskImpact = diff?.riskImpact ?? 0;

  const mode = determineMigrationMode(changeType, riskImpact);

  // ─── Determine blockers ───
  const blockers: VoiceMigrationBlocker[] = [];

  if (changeType === "breaking" && mode !== "dual_run") {
    blockers.push("breaking_change_without_dual_run");
  }

  if (riskImpact >= 70) {
    blockers.push("high_risk_without_review");
  }

  // Rollback path: default to fromVersion
  const rollbackPath = fromSnapshot.version;

  // Calculate overall risk score
  const riskScore = Math.min(
    100,
    Math.round(riskImpact * 0.6 + getModeRiskMultiplier(mode) * 0.4),
  );

  const migration: VoiceCoreMigration = {
    migrationId: generateMigrationId(),
    fromSnapshotId: fromSnapshot.snapshotId,
    toSnapshotId: toSnapshot.snapshotId,
    fromVersion: fromSnapshot.version,
    toVersion: toSnapshot.version,
    mode,
    status: "planned",
    diffAnalysis: diff
      ? {
          diffId: diff.diffId,
          changeType: diff.changeType,
          riskImpact: diff.riskImpact,
        }
      : undefined,
    blockers,
    approved: false,
    riskScore,
    rollbackPath,
    plannedAt: Date.now(),
  };

  const validationErrors = validateMigration(migration);

  return { migration, validationErrors, blockers };
}

function determineMigrationMode(
  changeType: VoiceDiffChangeType,
  riskImpact: number,
): VoiceMigrationMode {
  // Breaking changes: require dual_run
  if (changeType === "breaking") {
    return "dual_run";
  }

  // Major changes: staged with caution
  if (changeType === "major" || riskImpact >= 60) {
    return "staged";
  }

  // Moderate changes: staged or shadow
  if (changeType === "moderate" || riskImpact >= 30) {
    return "staged";
  }

  // Minor changes: shadow is sufficient
  return "shadow";
}

function getModeRiskMultiplier(mode: VoiceMigrationMode): number {
  switch (mode) {
    case "shadow":
      return 20;
    case "staged":
      return 40;
    case "dual_run":
      return 60;
    case "full_cutover":
      return 90;
    default:
      return 40;
  }
}

// ============================================================================
// Migration approval
// ============================================================================

/**
 * Approve a planned migration.
 */
export function approveMigration(
  migration: VoiceCoreMigration,
  approvedBy: string,
): VoiceCoreMigration {
  if (migration.status !== "planned") {
    const err = new Error(
      `Cannot approve migration: status is "${migration.status}", must be "planned"`,
    );
    (err as any).code = "INVALID_MIGRATION_STATUS";
    throw err;
  }

  return {
    ...migration,
    approved: true,
    approvedBy,
    approvedAt: Date.now(),
    status: "approved",
  };
}

/**
 * Start an approved migration.
 */
export function startMigration(
  migration: VoiceCoreMigration,
): VoiceCoreMigration {
  if (migration.status !== "approved") {
    const err = new Error(
      `Cannot start migration: status is "${migration.status}", must be "approved"`,
    );
    (err as any).code = "INVALID_MIGRATION_STATUS";
    throw err;
  }

  if (migration.blockers.length > 0) {
    const err = new Error(
      `Cannot start migration with unresolved blockers: ${migration.blockers.join(", ")}`,
    );
    (err as any).code = "MIGRATION_BLOCKED";
    throw err;
  }

  return {
    ...migration,
    status: "running",
    startedAt: Date.now(),
  };
}

/**
 * Complete a migration successfully.
 */
export function completeMigration(
  migration: VoiceCoreMigration,
): VoiceCoreMigration {
  if (migration.status !== "running") {
    const err = new Error(
      `Cannot complete migration: status is "${migration.status}", must be "running"`,
    );
    (err as any).code = "INVALID_MIGRATION_STATUS";
    throw err;
  }

  return {
    ...migration,
    status: "completed",
    completedAt: Date.now(),
  };
}

/**
 * Mark migration as failed.
 */
export function failMigration(
  migration: VoiceCoreMigration,
  reason: string,
): VoiceCoreMigration {
  return {
    ...migration,
    status: "failed",
    failedReason: reason,
  };
}

/**
 * Roll back a migration.
 */
export function rollbackMigration(
  migration: VoiceCoreMigration,
  reason: string,
): VoiceCoreMigration {
  return {
    ...migration,
    status: "rolled_back",
    failedReason: reason,
  };
}

// ============================================================================
// Migration registry
// ============================================================================

export interface VoiceMigrationRegistry {
  migrations: Map<string, VoiceCoreMigration>;
  maxMigrations: number;
}

const DEFAULT_MIGRATION_MAX = 50;

let _migrationRegistry: VoiceMigrationRegistry = {
  migrations: new Map(),
  maxMigrations: DEFAULT_MIGRATION_MAX,
};

export function registerMigration(migration: VoiceCoreMigration): void {
  if (_migrationRegistry.migrations.size >= _migrationRegistry.maxMigrations) {
    throw new Error(
      `Migration registry full (max ${_migrationRegistry.maxMigrations}). Cannot register ${migration.migrationId}`,
    );
  }
  _migrationRegistry.migrations.set(migration.migrationId, migration);
}

export function getMigration(
  migrationId: string,
): VoiceCoreMigration | undefined {
  return _migrationRegistry.migrations.get(migrationId);
}

export function getActiveMigration(): VoiceCoreMigration | undefined {
  return Array.from(_migrationRegistry.migrations.values()).find(
    (m) => m.status === "running",
  );
}

export function getMigrationsForVersion(
  version: string,
): VoiceCoreMigration[] {
  return Array.from(_migrationRegistry.migrations.values()).filter(
    (m) => m.fromVersion === version || m.toVersion === version,
  );
}

export function getCompletedMigrations(): VoiceCoreMigration[] {
  return Array.from(_migrationRegistry.migrations.values()).filter(
    (m) => m.status === "completed",
  );
}

export function getFailedMigrations(): VoiceCoreMigration[] {
  return Array.from(_migrationRegistry.migrations.values()).filter(
    (m) => m.status === "failed" || m.status === "rolled_back",
  );
}

export function getAllMigrations(): VoiceCoreMigration[] {
  return Array.from(_migrationRegistry.migrations.values())
    .sort((a, b) => b.plannedAt - a.plannedAt);
}

export function removeMigration(migrationId: string): boolean {
  return _migrationRegistry.migrations.delete(migrationId);
}

export function clearMigrationRegistry(): void {
  _migrationRegistry = {
    migrations: new Map(),
    maxMigrations: DEFAULT_MIGRATION_MAX,
  };
}

export function setMigrationRegistryForTest(
  registry: VoiceMigrationRegistry,
): void {
  _migrationRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceCoreMigration(migration: VoiceCoreMigration): string {
  const modeEmoji: Record<VoiceMigrationMode, string> = {
    shadow: "👤",
    staged: "📈",
    dual_run: "🔀",
    full_cutover: "✂️",
  };

  const statusEmoji: Record<VoiceMigrationStatus, string> = {
    planned: "📋",
    approved: "✅",
    running: "▶️",
    completed: "🎉",
    failed: "❌",
    rolled_back: "↩️",
  };

  const lines = [
    `🔄 Voice Core Migration`,
    `• migration ID: ${migration.migrationId}`,
    `• from: ${migration.fromVersion} → to: ${migration.toVersion}`,
    `• mode: ${modeEmoji[migration.mode]} ${migration.mode}`,
    `• status: ${statusEmoji[migration.status]} ${migration.status}`,
    `• risk score: ${migration.riskScore}%`,
    migration.diffAnalysis
      ? `• diff: ${migration.diffAnalysis.changeType} (risk ${migration.diffAnalysis.riskImpact}%)`
      : null,
    migration.blockers.length > 0
      ? `• blockers: ${migration.blockers.join(", ")}`
      : `• blockers: none`,
    `• approved: ${migration.approved ? `yes (${migration.approvedBy})` : "no"}`,
    migration.rollbackPath
      ? `• rollback path: ${migration.rollbackPath}`
      : null,
    migration.startedAt
      ? `• started at: ${new Date(migration.startedAt).toISOString()}`
      : null,
    migration.completedAt
      ? `• completed at: ${new Date(migration.completedAt).toISOString()}`
      : null,
    migration.failedReason
      ? `• failed reason: ${migration.failedReason}`
      : null,
    `• planned at: ${new Date(migration.plannedAt).toISOString()}`,
  ];

  return lines.filter(Boolean).join("\n");
}
