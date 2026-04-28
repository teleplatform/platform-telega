/**
 * Voice Mission Model & Long-Run Governance Intent Layer v7.9
 *
 * First-class entity: VoiceGovernanceMission
 *
 * This layer answers:
 *   - "What long-running, cross-domain mission is the system currently executing?"
 *   - "What is the mission intent, target domains, and priority?"
 *   - "What is the current status of each mission?"
 *
 * This layer does NOT:
 *   - build execution graphs (delegated to V8.0)
 *   - supervise mission execution (delegated to V8.1)
 *   - replan missions (delegated to V8.2)
 *
 * RULE: NO LONG-RUN CROSS-DOMAIN ACTION WITHOUT MISSION MODEL
 */

import type { VoiceGlobalState } from "./voiceDomainOrchestrator.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceMissionType =
  | "stabilize_system"
  | "reduce_risk"
  | "improve_learning_quality"
  | "recover_from_crisis"
  | "prepare_growth_mode";

export type VoiceMissionPriority =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type VoiceMissionHorizon =
  | "short"
  | "medium"
  | "long";

export type VoiceMissionStatus =
  | "planned"
  | "active"
  | "blocked"
  | "completed"
  | "aborted";

export interface VoiceGovernanceMission {
  missionId: string;

  missionType: VoiceMissionType;

  targetDomains: string[]; // domain IDs

  priority: VoiceMissionPriority;

  missionHorizon: VoiceMissionHorizon;

  intentSummary: string;

  missionStatus: VoiceMissionStatus;

  createdAt: number;

  // Optional metadata
  initiatedBy?: string; // actor ID or "system"
  parentMissionId?: string; // for sub-missions
  tags?: string[];

  // Lifecycle tracking
  activatedAt?: number;
  completedAt?: number;
  abortedAt?: number;
  abortReason?: string;
}

export type VoiceMissionValidationError =
  | "invalid_mission_type"
  | "invalid_priority"
  | "invalid_horizon"
  | "invalid_status"
  | "no_target_domains"
  | "empty_intent_summary";

// ============================================================================
// ID generation
// ============================================================================

function generateMissionId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_mission_${timestamp}_${random}`;
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

const VALID_MISSION_TYPES: VoiceMissionType[] = [
  "stabilize_system",
  "reduce_risk",
  "improve_learning_quality",
  "recover_from_crisis",
  "prepare_growth_mode",
];

const VALID_PRIORITIES: VoiceMissionPriority[] = [
  "low",
  "medium",
  "high",
  "critical",
];

const VALID_HORIZONS: VoiceMissionHorizon[] = ["short", "medium", "long"];

const VALID_STATUSES: VoiceMissionStatus[] = [
  "planned",
  "active",
  "blocked",
  "completed",
  "aborted",
];

export function validateMission(
  mission: Partial<VoiceGovernanceMission>,
): VoiceMissionValidationError[] {
  const errors: VoiceMissionValidationError[] = [];

  if (
    mission.missionType &&
    !VALID_MISSION_TYPES.includes(mission.missionType)
  ) {
    errors.push("invalid_mission_type");
  }

  if (mission.priority && !VALID_PRIORITIES.includes(mission.priority)) {
    errors.push("invalid_priority");
  }

  if (mission.missionHorizon && !VALID_HORIZONS.includes(mission.missionHorizon)) {
    errors.push("invalid_horizon");
  }

  if (mission.missionStatus && !VALID_STATUSES.includes(mission.missionStatus)) {
    errors.push("invalid_status");
  }

  if (!mission.targetDomains || mission.targetDomains.length === 0) {
    errors.push("no_target_domains");
  }

  if (
    mission.intentSummary !== undefined &&
    mission.intentSummary.trim().length === 0
  ) {
    errors.push("empty_intent_summary");
  }

  return errors;
}

// ============================================================================
// Mission type defaults
// ============================================================================

const MISSION_TYPE_DEFAULTS: Record<
  VoiceMissionType,
  {
    defaultPriority: VoiceMissionPriority;
    defaultHorizon: VoiceMissionHorizon;
    intentTemplate: string;
  }
> = {
  stabilize_system: {
    defaultPriority: "high",
    defaultHorizon: "medium",
    intentTemplate: "Stabilize system performance across target domains",
  },

  reduce_risk: {
    defaultPriority: "high",
    defaultHorizon: "medium",
    intentTemplate: "Reduce operational risk and improve safety margins",
  },

  improve_learning_quality: {
    defaultPriority: "medium",
    defaultHorizon: "long",
    intentTemplate: "Improve learning quality and decision accuracy",
  },

  recover_from_crisis: {
    defaultPriority: "critical",
    defaultHorizon: "short",
    intentTemplate: "Recover system from crisis state to stable operation",
  },

  prepare_growth_mode: {
    defaultPriority: "medium",
    defaultHorizon: "long",
    intentTemplate: "Prepare system for growth phase with controlled expansion",
  },
};

// ============================================================================
// Core mission creation
// ============================================================================

export interface VoiceMissionInput {
  missionType: VoiceMissionType;
  targetDomains: string[];
  intentSummary?: string;
  priority?: VoiceMissionPriority;
  missionHorizon?: VoiceMissionHorizon;
  initiatedBy?: string;
  parentMissionId?: string;
  tags?: string[];
}

/**
 * Create a new governance mission.
 * Pure function — applies defaults and validates.
 */
export function createVoiceGovernanceMission(
  input: VoiceMissionInput,
): {
  mission: VoiceGovernanceMission;
  validationErrors: VoiceMissionValidationError[];
} {
  const defaults = MISSION_TYPE_DEFAULTS[input.missionType];

  const mission: VoiceGovernanceMission = {
    missionId: generateMissionId(),
    missionType: input.missionType,
    targetDomains: input.targetDomains,
    priority: input.priority ?? defaults.defaultPriority,
    missionHorizon: input.missionHorizon ?? defaults.defaultHorizon,
    intentSummary: input.intentSummary ?? defaults.intentTemplate,
    missionStatus: "planned",
    createdAt: Date.now(),
    initiatedBy: input.initiatedBy ?? "system",
    parentMissionId: input.parentMissionId,
    tags: input.tags ?? [],
  };

  const validationErrors = validateMission(mission);

  return { mission, validationErrors };
}

// ============================================================================
// Mission lifecycle management
// ============================================================================

export function activateMission(
  mission: VoiceGovernanceMission,
): VoiceGovernanceMission {
  if (mission.missionStatus !== "planned") {
    return mission; // can only activate from planned
  }

  return {
    ...mission,
    missionStatus: "active",
    activatedAt: Date.now(),
  };
}

export function blockMission(
  mission: VoiceGovernanceMission,
  reason: string,
): VoiceGovernanceMission {
  return {
    ...mission,
    missionStatus: "blocked",
    abortReason: reason,
  };
}

export function unblockMission(
  mission: VoiceGovernanceMission,
): VoiceGovernanceMission {
  if (mission.missionStatus !== "blocked") {
    return mission;
  }

  return {
    ...mission,
    missionStatus: "planned",
    abortReason: undefined,
  };
}

export function completeMission(
  mission: VoiceGovernanceMission,
): VoiceGovernanceMission {
  if (mission.missionStatus !== "active" && mission.missionStatus !== "blocked") {
    return mission; // can only complete active or blocked
  }

  return {
    ...mission,
    missionStatus: "completed",
    completedAt: Date.now(),
  };
}

export function abortMission(
  mission: VoiceGovernanceMission,
  reason: string,
): VoiceGovernanceMission {
  return {
    ...mission,
    missionStatus: "aborted",
    abortedAt: Date.now(),
    abortReason: reason,
  };
}

// ============================================================================
// Mission inference from global state
// ============================================================================

/**
 * Infer appropriate mission type from global state and context.
 * Pure function — deterministic.
 */
export function inferMissionFromGlobalState(
  globalState: VoiceGlobalState,
): VoiceMissionType {
  switch (globalState) {
    case "critical":
      return "recover_from_crisis";
    case "constrained":
      return "stabilize_system";
    case "adaptive":
      return "improve_learning_quality";
    case "stable":
      return "prepare_growth_mode";
  }
}

/**
 * Determine mission priority from global state and risk level.
 */
export function determineMissionPriority(
  globalState: VoiceGlobalState,
  riskLevel: number, // 0..100
): VoiceMissionPriority {
  if (globalState === "critical" || riskLevel > 80) return "critical";
  if (globalState === "constrained" || riskLevel > 60) return "high";
  if (globalState === "adaptive" || riskLevel > 40) return "medium";
  return "low";
}

/**
 * Determine mission horizon from mission type and global state.
 */
export function determineMissionHorizon(
  missionType: VoiceMissionType,
  globalState: VoiceGlobalState,
): VoiceMissionHorizon {
  // Crisis recovery is always short
  if (missionType === "recover_from_crisis") return "short";

  // Critical state missions are short-term
  if (globalState === "critical") return "short";

  // Stabilization is medium
  if (missionType === "stabilize_system" || missionType === "reduce_risk") {
    return "medium";
  }

  // Learning and growth are long-term
  return "long";
}

// ============================================================================
// Mission registry
// ============================================================================

export interface VoiceMissionRegistry {
  missions: Map<string, VoiceGovernanceMission>;
  maxActiveMissions: number;
}

const DEFAULT_MAX_ACTIVE_MISSIONS = 5;

let _missionRegistry: VoiceMissionRegistry = {
  missions: new Map(),
  maxActiveMissions: DEFAULT_MAX_ACTIVE_MISSIONS,
};

export function getVoiceMissionRegistry(): VoiceMissionRegistry {
  return {
    missions: new Map(_missionRegistry.missions),
    maxActiveMissions: _missionRegistry.maxActiveMissions,
  };
}

export function registerVoiceMission(mission: VoiceGovernanceMission): void {
  if (
    mission.missionStatus === "active" &&
    getActiveMissionCount() >= _missionRegistry.maxActiveMissions
  ) {
    throw new Error(
      `Cannot register active mission: max ${_missionRegistry.maxActiveMissions} active missions allowed`,
    );
  }
  _missionRegistry.missions.set(mission.missionId, mission);
}

export function getVoiceMission(missionId: string): VoiceGovernanceMission | undefined {
  return _missionRegistry.missions.get(missionId);
}

export function getAllVoiceMissions(): VoiceGovernanceMission[] {
  return Array.from(_missionRegistry.missions.values());
}

export function getActiveMissions(): VoiceGovernanceMission[] {
  return Array.from(_missionRegistry.missions.values()).filter(
    (m) => m.missionStatus === "active",
  );
}

export function getActiveMissionCount(): number {
  return getActiveMissions().length;
}

export function getMissionsByType(type: VoiceMissionType): VoiceGovernanceMission[] {
  return Array.from(_missionRegistry.missions.values()).filter(
    (m) => m.missionType === type,
  );
}

export function getMissionsForDomain(domainId: string): VoiceGovernanceMission[] {
  return Array.from(_missionRegistry.missions.values()).filter(
    (m) => m.targetDomains.includes(domainId),
  );
}

export function removeVoiceMission(missionId: string): boolean {
  return _missionRegistry.missions.delete(missionId);
}

export function clearVoiceMissionRegistry(): void {
  _missionRegistry = {
    missions: new Map(),
    maxActiveMissions: DEFAULT_MAX_ACTIVE_MISSIONS,
  };
}

export function setVoiceMissionRegistryForTest(
  registry: VoiceMissionRegistry,
): void {
  _missionRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceGovernanceMission(
  mission: VoiceGovernanceMission,
): string {
  const statusEmoji: Record<VoiceMissionStatus, string> = {
    planned: "📋",
    active: "🚀",
    blocked: "🚫",
    completed: "✅",
    aborted: "❌",
  };

  const priorityEmoji: Record<VoiceMissionPriority, string> = {
    low: "🔵",
    medium: "🟡",
    high: "🟠",
    critical: "🔴",
  };

  const lines = [
    `🎯 Voice Governance Mission`,
    `• mission ID: ${mission.missionId}`,
    `• type: ${mission.missionType}`,
    `• status: ${statusEmoji[mission.missionStatus]} ${mission.missionStatus}`,
    `• priority: ${priorityEmoji[mission.priority]} ${mission.priority}`,
    `• horizon: ${mission.missionHorizon}`,
    `• intent: ${mission.intentSummary}`,
    `• target domains: ${mission.targetDomains.length} (${mission.targetDomains.join(", ") || "none"})`,
    `• initiated by: ${mission.initiatedBy ?? "system"}`,
    `• created at: ${new Date(mission.createdAt).toISOString()}`,
  ];

  if (mission.activatedAt) {
    lines.push(`• activated at: ${new Date(mission.activatedAt).toISOString()}`);
  }

  if (mission.completedAt) {
    lines.push(`• completed at: ${new Date(mission.completedAt).toISOString()}`);
  }

  if (mission.abortedAt) {
    lines.push(`• aborted at: ${new Date(mission.abortedAt).toISOString()}`);
    if (mission.abortReason) {
      lines.push(`• abort reason: ${mission.abortReason}`);
    }
  }

  if (mission.parentMissionId) {
    lines.push(`• parent mission: ${mission.parentMissionId}`);
  }

  if (mission.tags && mission.tags.length > 0) {
    lines.push(`• tags: ${mission.tags.join(", ")}`);
  }

  return lines.join("\n");
}

export function formatVoiceMissionRegistry(
  registry: VoiceMissionRegistry,
): string {
  const lines = [
    `🎯 Voice Mission Registry (${registry.missions.size} missions, ${getActiveMissionCount()} active)`,
  ];

  for (const mission of registry.missions.values()) {
    const status =
      mission.missionStatus === "active" ? "🚀" :
      mission.missionStatus === "completed" ? "✅" :
      mission.missionStatus === "aborted" ? "❌" :
      mission.missionStatus === "blocked" ? "🚫" : "📋";

    lines.push(
      `  ${status} ${mission.missionType} [${mission.priority}] domains=${mission.targetDomains.length} "${mission.intentSummary.slice(0, 50)}..."`,
    );
  }

  return lines.join("\n");
}
