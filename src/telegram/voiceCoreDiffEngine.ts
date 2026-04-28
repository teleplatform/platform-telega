/**
 * Voice Core Semantic Diff Engine v9.5
 *
 * First-class entity: VoiceCoreDiff
 *
 * This layer answers:
 *   - "What changed between two core snapshots?"
 *   - "What is the semantic impact of these changes?"
 *   - "Which domains are affected?"
 *
 * This layer does NOT:
 *   - create snapshots (delegated to V9.4)
 *   - manage migrations (delegated to V9.6)
 *
 * RULE: NO SNAPSHOT ACTIVATION WITHOUT DIFF-AWARE IMPACT ANALYSIS
 */

import type { VoiceCoreSnapshot } from "./voiceCoreSnapshot.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceDiffChangeType = "minor" | "moderate" | "major" | "breaking";

export type VoiceDiffDomain =
  | "mission_planning"
  | "adaptation_gate"
  | "strategy_selection"
  | "domain_coordination"
  | "review_routing"
  | "consistency_guard"
  | "governance_reaction"
  | "knowledge_federation"
  | "collective_intelligence"
  | "constitutional_admission"
  | "core_deployment"
  | "integrity_sentinel";

export interface VoiceDiffChange {
  type: "added" | "removed" | "modified";
  targetId: string;
  targetType: "template" | "federation" | "promotion_decision";
  severity: number; // 0..100
  description?: string;
}

export interface VoiceCoreDiff {
  diffId: string;

  fromSnapshotId: string;
  toSnapshotId: string;

  fromVersion: string;
  toVersion: string;

  changes: VoiceDiffChange[];

  changeType: VoiceDiffChangeType;

  affectedDomains: VoiceDiffDomain[];

  riskImpact: number; // 0..100

  templateDelta: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };

  federationDelta: {
    added: string[];
    removed: string[];
    unchanged: string[];
  };

  computedAt: number;
}

export type VoiceDiffValidationError =
  | "same_snapshot_comparison"
  | "invalid_change_type"
  | "risk_impact_out_of_range"
  | "no_changes_detected";

// ============================================================================
// ID generation
// ============================================================================

function generateDiffId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_diff_${timestamp}_${random}`;
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

const VALID_CHANGE_TYPES: VoiceDiffChangeType[] = [
  "minor",
  "moderate",
  "major",
  "breaking",
];

export function validateDiff(
  diff: Partial<VoiceCoreDiff>,
): VoiceDiffValidationError[] {
  const errors: VoiceDiffValidationError[] = [];

  if (
    diff.fromSnapshotId &&
    diff.toSnapshotId &&
    diff.fromSnapshotId === diff.toSnapshotId
  ) {
    errors.push("same_snapshot_comparison");
  }

  if (
    diff.changeType &&
    !VALID_CHANGE_TYPES.includes(diff.changeType)
  ) {
    errors.push("invalid_change_type");
  }

  if (
    diff.riskImpact !== undefined &&
    (diff.riskImpact < 0 || diff.riskImpact > 100)
  ) {
    errors.push("risk_impact_out_of_range");
  }

  if (diff.changes && diff.changes.length === 0) {
    errors.push("no_changes_detected");
  }

  return errors;
}

// ============================================================================
// Diff computation
// ============================================================================

export interface VoiceDiffComputationInput {
  fromSnapshot: VoiceCoreSnapshot;
  toSnapshot: VoiceCoreSnapshot;
  // Optional domain mapping for templates
  templateDomains?: Map<string, VoiceDiffDomain[]>;
}

/**
 * Compute semantic diff between two core snapshots.
 * Pure function — analyzes template/federation deltas and determines impact.
 */
export function computeCoreDiff(
  input: VoiceDiffComputationInput,
): {
  diff: VoiceCoreDiff;
  validationErrors: VoiceDiffValidationError[];
} {
  const { fromSnapshot, toSnapshot } = input;

  // ─── Template delta ───
  const fromTemplates = new Set(fromSnapshot.includedTemplates);
  const toTemplates = new Set(toSnapshot.includedTemplates);

  const addedTemplates = [...toTemplates].filter((t) => !fromTemplates.has(t));
  const removedTemplates = [...fromTemplates].filter((t) => !toTemplates.has(t));
  const unchangedTemplates = [...toTemplates].filter((t) => fromTemplates.has(t));

  // ─── Federation delta ───
  const fromFederations = new Set(fromSnapshot.includedFederations);
  const toFederations = new Set(toSnapshot.includedFederations);

  const addedFederations = [...toFederations].filter(
    (f) => !fromFederations.has(f),
  );
  const removedFederations = [...fromFederations].filter(
    (f) => !toFederations.has(f),
  );
  const unchangedFederations = [...toFederations].filter(
    (f) => fromFederations.has(f),
  );

  // ─── Build changes list ───
  const changes: VoiceDiffChange[] = [];

  for (const t of addedTemplates) {
    changes.push({
      type: "added",
      targetId: t,
      targetType: "template",
      severity: 30,
      description: `Template added in ${toSnapshot.version}`,
    });
  }

  for (const t of removedTemplates) {
    changes.push({
      type: "removed",
      targetId: t,
      targetType: "template",
      severity: 50,
      description: `Template removed from ${fromSnapshot.version}`,
    });
  }

  for (const f of addedFederations) {
    changes.push({
      type: "added",
      targetId: f,
      targetType: "federation",
      severity: 25,
      description: `Federation added in ${toSnapshot.version}`,
    });
  }

  for (const f of removedFederations) {
    changes.push({
      type: "removed",
      targetId: f,
      targetType: "federation",
      severity: 40,
      description: `Federation removed from ${fromSnapshot.version}`,
    });
  }

  // ─── Determine affected domains ───
  const domainSet = new Set<VoiceDiffDomain>();
  if (input.templateDomains) {
    for (const changedTemplate of [...addedTemplates, ...removedTemplates]) {
      const domains = input.templateDomains.get(changedTemplate);
      if (domains) {
        for (const d of domains) domainSet.add(d);
      }
    }
  }

  // If no domain mapping, infer from change types
  if (domainSet.size === 0) {
    if (addedTemplates.length > 0 || removedTemplates.length > 0) {
      domainSet.add("collective_intelligence");
      domainSet.add("constitutional_admission");
    }
    if (addedFederations.length > 0 || removedFederations.length > 0) {
      domainSet.add("knowledge_federation");
    }
  }

  const affectedDomains = [...domainSet];

  // ─── Classify change type ───
  const changeType = classifyDiffChange(
    changes,
    addedTemplates.length,
    removedTemplates.length,
    addedFederations.length,
    removedFederations.length,
  );

  // ─── Calculate risk impact ───
  const riskImpact = calculateRiskImpact(
    changes,
    changeType,
    fromSnapshot.includedTemplates.length,
    toSnapshot.includedTemplates.length,
  );

  const diff: VoiceCoreDiff = {
    diffId: generateDiffId(),
    fromSnapshotId: fromSnapshot.snapshotId,
    toSnapshotId: toSnapshot.snapshotId,
    fromVersion: fromSnapshot.version,
    toVersion: toSnapshot.version,
    changes,
    changeType,
    affectedDomains,
    riskImpact,
    templateDelta: {
      added: addedTemplates,
      removed: removedTemplates,
      unchanged: unchangedTemplates,
    },
    federationDelta: {
      added: addedFederations,
      removed: removedFederations,
      unchanged: unchangedFederations,
    },
    computedAt: Date.now(),
  };

  const validationErrors = validateDiff(diff);

  return { diff, validationErrors };
}

// ============================================================================
// Classification logic
// ============================================================================

function classifyDiffChange(
  changes: VoiceDiffChange[],
  addedTemplates: number,
  removedTemplates: number,
  addedFederations: number,
  removedFederations: number,
): VoiceDiffChangeType {
  const totalChanges = changes.length;
  const removals = removedTemplates + removedFederations;
  const additions = addedTemplates + addedFederations;

  // Breaking: significant removals or high-severity changes
  if (removals >= 5 || changes.some((c) => c.severity >= 80)) {
    return "breaking";
  }

  // Major: large change volume or significant removals
  if (totalChanges >= 10 || removals >= 3 || additions >= 8) {
    return "major";
  }

  // Moderate: moderate changes
  if (totalChanges >= 3 || removals >= 1 || additions >= 3) {
    return "moderate";
  }

  // Minor: small additions or no removals
  return "minor";
}

function calculateRiskImpact(
  changes: VoiceDiffChange[],
  changeType: VoiceDiffChangeType,
  fromTemplateCount: number,
  toTemplateCount: number,
): number {
  let risk = 0;

  // Base risk from change type
  switch (changeType) {
    case "breaking":
      risk += 60;
      break;
    case "major":
      risk += 40;
      break;
    case "moderate":
      risk += 25;
      break;
    case "minor":
      risk += 10;
      break;
  }

  // Risk from removals (more dangerous than additions)
  const removals = changes.filter((c) => c.type === "removed");
  risk += removals.length * 8;

  // Risk from template count delta
  const templateDelta = Math.abs(toTemplateCount - fromTemplateCount);
  if (fromTemplateCount > 0) {
    const deltaPercent = (templateDelta / fromTemplateCount) * 100;
    risk += Math.min(20, Math.round(deltaPercent * 0.4));
  }

  return Math.min(100, Math.max(0, risk));
}

// ============================================================================
// Diff registry
// ============================================================================

export interface VoiceDiffRegistry {
  diffs: Map<string, VoiceCoreDiff>;
  maxDiffs: number;
}

const DEFAULT_DIFF_MAX = 100;

let _diffRegistry: VoiceDiffRegistry = {
  diffs: new Map(),
  maxDiffs: DEFAULT_DIFF_MAX,
};

export function registerDiff(diff: VoiceCoreDiff): void {
  if (_diffRegistry.diffs.size >= _diffRegistry.maxDiffs) {
    throw new Error(
      `Diff registry full (max ${_diffRegistry.maxDiffs}). Cannot register ${diff.diffId}`,
    );
  }
  _diffRegistry.diffs.set(diff.diffId, diff);
}

export function getDiff(diffId: string): VoiceCoreDiff | undefined {
  return _diffRegistry.diffs.get(diffId);
}

export function getDiffBetweenSnapshots(
  fromSnapshotId: string,
  toSnapshotId: string,
): VoiceCoreDiff | undefined {
  return Array.from(_diffRegistry.diffs.values()).find(
    (d) =>
      d.fromSnapshotId === fromSnapshotId &&
      d.toSnapshotId === toSnapshotId,
  );
}

export function getDiffsByChangeType(
  changeType: VoiceDiffChangeType,
): VoiceCoreDiff[] {
  return Array.from(_diffRegistry.diffs.values()).filter(
    (d) => d.changeType === changeType,
  );
}

export function getHighRiskDiffs(minRisk: number = 50): VoiceCoreDiff[] {
  return Array.from(_diffRegistry.diffs.values()).filter(
    (d) => d.riskImpact >= minRisk,
  );
}

export function getAllDiffs(): VoiceCoreDiff[] {
  return Array.from(_diffRegistry.diffs.values())
    .sort((a, b) => b.computedAt - a.computedAt);
}

export function removeDiff(diffId: string): boolean {
  return _diffRegistry.diffs.delete(diffId);
}

export function clearDiffRegistry(): void {
  _diffRegistry = {
    diffs: new Map(),
    maxDiffs: DEFAULT_DIFF_MAX,
  };
}

export function setDiffRegistryForTest(registry: VoiceDiffRegistry): void {
  _diffRegistry = registry;
}

// ============================================================================
// Activation gate
// ============================================================================

/**
 * Check if a snapshot can be activated based on diff analysis.
 * RULE: NO SNAPSHOT ACTIVATION WITHOUT DIFF-AWARE IMPACT ANALYSIS
 */
export function canActivateSnapshot(
  diff: VoiceCoreDiff,
  options?: { maxAcceptableRisk?: number; allowBreaking?: boolean },
): { allowed: boolean; reason: string; blockers: string[] } {
  const maxRisk = options?.maxAcceptableRisk ?? 60;
  const allowBreaking = options?.allowBreaking ?? false;

  const blockers: string[] = [];

  if (!allowBreaking && diff.changeType === "breaking") {
    blockers.push(
      `Breaking change detected (risk ${diff.riskImpact}%). Breaking changes require special approval.`,
    );
  }

  if (diff.riskImpact > maxRisk) {
    blockers.push(
      `Risk impact ${diff.riskImpact}% exceeds threshold ${maxRisk}%.`,
    );
  }

  const removals = diff.changes.filter((c) => c.type === "removed");
  if (removals.length >= 5) {
    blockers.push(
      `High number of removals (${removals.length}). Core stability may be affected.`,
    );
  }

  return {
    allowed: blockers.length === 0,
    reason:
      blockers.length === 0
        ? `Diff analysis passed: ${diff.changeType} change, risk ${diff.riskImpact}%`
        : `Snapshot activation blocked: ${blockers.join("; ")}`,
    blockers,
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceCoreDiff(diff: VoiceCoreDiff): string {
  const typeEmoji: Record<VoiceDiffChangeType, string> = {
    minor: "🟢",
    moderate: "🟡",
    major: "🟠",
    breaking: "🔴",
  };

  const changeEmoji: Record<VoiceDiffChange["type"], string> = {
    added: "➕",
    removed: "➖",
    modified: "🔄",
  };

  const lines = [
    `🔍 Voice Core Semantic Diff`,
    `• diff ID: ${diff.diffId}`,
    `• from: ${diff.fromVersion} → to: ${diff.toVersion}`,
    `• change type: ${typeEmoji[diff.changeType]} ${diff.changeType}`,
    `• risk impact: ${diff.riskImpact}%`,
    `• affected domains: ${diff.affectedDomains.join(", ") || "none"}`,
    `--- Template Delta ---`,
    `  • added: ${diff.templateDelta.added.length}`,
    `  • removed: ${diff.templateDelta.removed.length}`,
    `  • unchanged: ${diff.templateDelta.unchanged.length}`,
    `--- Federation Delta ---`,
    `  • added: ${diff.federationDelta.added.length}`,
    `  • removed: ${diff.federationDelta.removed.length}`,
    `  • unchanged: ${diff.federationDelta.unchanged.length}`,
    `--- Changes (${diff.changes.length}) ---`,
  ];

  for (const change of diff.changes.slice(0, 10)) {
    lines.push(
      `  ${changeEmoji[change.type]} ${change.targetType}:${change.targetId.slice(0, 30)}... (severity ${change.severity})`,
    );
  }

  if (diff.changes.length > 10) {
    lines.push(`  ... and ${diff.changes.length - 10} more`);
  }

  lines.push(`• computed at: ${new Date(diff.computedAt).toISOString()}`);

  return lines.filter(Boolean).join("\n");
}
