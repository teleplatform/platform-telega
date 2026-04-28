/**
 * Voice Core Snapshot & Version Authority Layer v9.4
 *
 * First-class entity: VoiceCoreSnapshot
 *
 * This layer answers:
 *   - "What is the official versioned state of the core at this moment?"
 *   - "Which templates and federations are included in this snapshot?"
 *   - "What is the lifecycle status of this snapshot?"
 *
 * This layer does NOT:
 *   - compute diffs between snapshots (delegated to V9.5)
 *   - manage migrations (delegated to V9.6)
 *
 * RULE: NO CORE EVOLUTION WITHOUT SNAPSHOT VERSION
 */

import type { VoiceCoreKnowledgePromotionDecision } from "./voiceCoreKnowledgePromotion.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceSnapshotStatus =
  | "draft"
  | "candidate"
  | "active"
  | "deprecated"
  | "rolled_back";

export type VoiceSnapshotValidationError =
  | "invalid_version_format"
  | "no_included_templates"
  | "invalid_status"
  | "active_snapshot_already_exists";

export interface VoiceCoreSnapshot {
  snapshotId: string;

  version: string; // semver-like: "v1.0.0"

  includedTemplates: string[]; // template IDs
  includedFederations: string[]; // federation IDs

  sourcePromotionDecisions: string[]; // promotion decision IDs

  status: VoiceSnapshotStatus;

  parentVersion?: string; // previous snapshot version

  createdAt: number;
  activatedAt?: number;
  deprecatedAt?: number;
  rolledBackAt?: number;

  // Metadata
  templateCount: number;
  federationCount: number;
  avgTemplateRank: number;
  description?: string;
}

// ============================================================================
// ID generation
// ============================================================================

function generateSnapshotId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_snap_${timestamp}_${random}`;
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

const VALID_STATUSES: VoiceSnapshotStatus[] = [
  "draft",
  "candidate",
  "active",
  "deprecated",
  "rolled_back",
];

const VERSION_REGEX = /^v\d+\.\d+\.\d+$/;

export function validateSnapshot(
  snapshot: Partial<VoiceCoreSnapshot>,
): VoiceSnapshotValidationError[] {
  const errors: VoiceSnapshotValidationError[] = [];

  if (
    snapshot.version &&
    !VERSION_REGEX.test(snapshot.version)
  ) {
    errors.push("invalid_version_format");
  }

  if (
    snapshot.includedTemplates &&
    snapshot.includedTemplates.length === 0
  ) {
    errors.push("no_included_templates");
  }

  if (
    snapshot.status &&
    !VALID_STATUSES.includes(snapshot.status)
  ) {
    errors.push("invalid_status");
  }

  return errors;
}

// ============================================================================
// Snapshot creation
// ============================================================================

export interface VoiceCreateSnapshotInput {
  version: string;
  templates: Array<{
    templateId: string;
    rank: number;
  }>;
  federations: string[];
  promotionDecisionIds: string[];
  parentVersion?: string;
  description?: string;
}

/**
 * Create a new core snapshot.
 * Pure function — creates a versioned snapshot of the current core state.
 */
export function createCoreSnapshot(
  input: VoiceCreateSnapshotInput,
): {
  snapshot: VoiceCoreSnapshot;
  validationErrors: VoiceSnapshotValidationError[];
} {
  const templateIds = input.templates.map((t) => t.templateId);
  const avgRank = input.templates.length > 0
    ? Math.round(
        input.templates.reduce((sum, t) => sum + t.rank, 0) / input.templates.length,
      )
    : 0;

  const snapshot: VoiceCoreSnapshot = {
    snapshotId: generateSnapshotId(),
    version: input.version,
    includedTemplates: templateIds,
    includedFederations: input.federations,
    sourcePromotionDecisions: input.promotionDecisionIds,
    status: "draft",
    parentVersion: input.parentVersion,
    createdAt: Date.now(),
    templateCount: templateIds.length,
    federationCount: input.federations.length,
    avgTemplateRank: avgRank,
    description: input.description,
  };

  const validationErrors = validateSnapshot(snapshot);

  return { snapshot, validationErrors };
}

// ============================================================================
// Snapshot lifecycle
// ============================================================================

/**
 * Promote snapshot from draft to candidate.
 */
export function promoteToCandidate(
  snapshot: VoiceCoreSnapshot,
): VoiceCoreSnapshot {
  if (snapshot.status !== "draft") {
    const err = new Error(
      `Cannot promote to candidate: status is "${snapshot.status}", must be "draft"`,
    );
    (err as any).code = "INVALID_SNAPSHOT_STATUS";
    throw err;
  }

  return { ...snapshot, status: "candidate" };
}

/**
 * Activate a candidate snapshot — makes it the current active core.
 * RULE: Only one active snapshot at a time.
 */
export function activateSnapshot(
  snapshot: VoiceCoreSnapshot,
  currentActive?: VoiceCoreSnapshot | null,
): {
  snapshot: VoiceCoreSnapshot;
  previousActive?: VoiceCoreSnapshot;
} {
  if (snapshot.status !== "candidate") {
    const err = new Error(
      `Cannot activate: status is "${snapshot.status}", must be "candidate"`,
    );
    (err as any).code = "INVALID_SNAPSHOT_STATUS";
    throw err;
  }

  const previousActive = currentActive
    ? { ...currentActive, status: "deprecated" as const, deprecatedAt: Date.now() }
    : undefined;

  const activated: VoiceCoreSnapshot = {
    ...snapshot,
    status: "active",
    activatedAt: Date.now(),
  };

  return { snapshot: activated, previousActive };
}

/**
 * Roll back an active snapshot.
 */
export function rollbackSnapshot(
  snapshot: VoiceCoreSnapshot,
): VoiceCoreSnapshot {
  if (snapshot.status !== "active") {
    const err = new Error(
      `Cannot rollback: status is "${snapshot.status}", must be "active"`,
    );
    (err as any).code = "INVALID_SNAPSHOT_STATUS";
    throw err;
  }

  return {
    ...snapshot,
    status: "rolled_back",
    rolledBackAt: Date.now(),
  };
}

// ============================================================================
// Snapshot registry
// ============================================================================

export interface VoiceSnapshotRegistry {
  snapshots: Map<string, VoiceCoreSnapshot>;
  maxSnapshots: number;
}

const DEFAULT_SNAPSHOT_MAX = 50;

let _snapshotRegistry: VoiceSnapshotRegistry = {
  snapshots: new Map(),
  maxSnapshots: DEFAULT_SNAPSHOT_MAX,
};

export function registerSnapshot(snapshot: VoiceCoreSnapshot): void {
  if (_snapshotRegistry.snapshots.size >= _snapshotRegistry.maxSnapshots) {
    throw new Error(
      `Snapshot registry full (max ${_snapshotRegistry.maxSnapshots}). Cannot register ${snapshot.snapshotId}`,
    );
  }
  _snapshotRegistry.snapshots.set(snapshot.snapshotId, snapshot);
}

export function getSnapshot(snapshotId: string): VoiceCoreSnapshot | undefined {
  return _snapshotRegistry.snapshots.get(snapshotId);
}

export function getSnapshotByVersion(
  version: string,
): VoiceCoreSnapshot | undefined {
  return Array.from(_snapshotRegistry.snapshots.values()).find(
    (s) => s.version === version,
  );
}

export function getActiveSnapshot(): VoiceCoreSnapshot | undefined {
  return Array.from(_snapshotRegistry.snapshots.values()).find(
    (s) => s.status === "active",
  );
}

export function getLatestSnapshot(): VoiceCoreSnapshot | undefined {
  const sorted = Array.from(_snapshotRegistry.snapshots.values())
    .sort((a, b) => b.createdAt - a.createdAt);
  return sorted[0];
}

export function getAllSnapshots(): VoiceCoreSnapshot[] {
  return Array.from(_snapshotRegistry.snapshots.values())
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getSnapshotsByStatus(
  status: VoiceSnapshotStatus,
): VoiceCoreSnapshot[] {
  return Array.from(_snapshotRegistry.snapshots.values())
    .filter((s) => s.status === status);
}

export function removeSnapshot(snapshotId: string): boolean {
  return _snapshotRegistry.snapshots.delete(snapshotId);
}

export function clearSnapshotRegistry(): void {
  _snapshotRegistry = {
    snapshots: new Map(),
    maxSnapshots: DEFAULT_SNAPSHOT_MAX,
  };
}

export function setSnapshotRegistryForTest(registry: VoiceSnapshotRegistry): void {
  _snapshotRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceCoreSnapshot(snapshot: VoiceCoreSnapshot): string {
  const statusEmoji: Record<VoiceSnapshotStatus, string> = {
    draft: "📝",
    candidate: "🎯",
    active: "✅",
    deprecated: "⚠️",
    rolled_back: "↩️",
  };

  const lines = [
    `📦 Voice Core Snapshot`,
    `• snapshot ID: ${snapshot.snapshotId}`,
    `• version: ${snapshot.version}`,
    `• status: ${statusEmoji[snapshot.status]} ${snapshot.status}`,
    snapshot.parentVersion ? `• parent version: ${snapshot.parentVersion}` : null,
    `• templates: ${snapshot.templateCount}`,
    `• federations: ${snapshot.federationCount}`,
    `• avg template rank: ${snapshot.avgTemplateRank}%`,
    snapshot.description ? `• description: ${snapshot.description}` : null,
    `• created at: ${new Date(snapshot.createdAt).toISOString()}`,
    snapshot.activatedAt
      ? `• activated at: ${new Date(snapshot.activatedAt).toISOString()}`
      : null,
    snapshot.deprecatedAt
      ? `• deprecated at: ${new Date(snapshot.deprecatedAt).toISOString()}`
      : null,
    snapshot.rolledBackAt
      ? `• rolled back at: ${new Date(snapshot.rolledBackAt).toISOString()}`
      : null,
  ];

  return lines.filter(Boolean).join("\n");
}
