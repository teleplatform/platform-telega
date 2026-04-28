/**
 * Voice Core Pattern Deployment — Governed Core Evolution Layer v9.2
 *
 * First-class entity: VoiceCorePatternDeployment
 *
 * This layer answers:
 *   - "How should admitted knowledge be safely deployed to core targets?"
 *   - "What deployment mode is appropriate for this knowledge scope?"
 *   - "Is the validation window sufficient for this deployment?"
 *
 * This layer does NOT:
 *   - admit knowledge to core (delegated to V9.1)
 *   - monitor integrity after deployment (delegated to V9.3)
 *
 * RULE: NO CORE PATTERN DEPLOYMENT MAY START DIRECTLY IN FULL ACTIVE MODE
 */

import type {
  VoicePromotionStatus,
  VoicePromotionScope,
} from "./voiceCoreKnowledgePromotion.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceDeploymentMode =
  | "shadow"
  | "limited"
  | "staged"
  | "core_active";

export type VoiceDeploymentStatus =
  | "prepared"
  | "running"
  | "validated"
  | "rolled_back"
  | "failed";

export type VoiceDeploymentTargetType =
  | "mission_planning"
  | "adaptation_gate"
  | "strategy_selection"
  | "domain_coordination"
  | "review_routing"
  | "consistency_guard"
  | "governance_reaction";

export interface VoiceDeploymentTarget {
  targetType: VoiceDeploymentTargetType;
  targetId: string;
}

export interface VoiceCorePatternDeployment {
  deploymentId: string;

  templateId: string;
  promotionDecisionId: string;

  deploymentTargets: VoiceDeploymentTarget[];

  deploymentMode: VoiceDeploymentMode;
  deploymentStatus: VoiceDeploymentStatus;

  validationWindowMs: number;
  startedAt?: number;
  validatedAt?: number;
  rolledBackAt?: number;
  failedReason?: string;

  createdAt: number;
}

export type VoiceDeploymentValidationError =
  | "invalid_template_id"
  | "invalid_promotion_decision_id"
  | "no_deployment_targets"
  | "invalid_deployment_mode"
  | "invalid_deployment_status"
  | "validation_window_out_of_range"
  | "direct_core_active_attempt";

// ============================================================================
// ID generation
// ============================================================================

function generateDeploymentId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_dep_${timestamp}_${random}`;
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

const VALID_DEPLOYMENT_MODES: VoiceDeploymentMode[] = [
  "shadow",
  "limited",
  "staged",
  "core_active",
];

const VALID_DEPLOYMENT_STATUSES: VoiceDeploymentStatus[] = [
  "prepared",
  "running",
  "validated",
  "rolled_back",
  "failed",
];

export function validateDeployment(
  deployment: Partial<VoiceCorePatternDeployment>,
): VoiceDeploymentValidationError[] {
  const errors: VoiceDeploymentValidationError[] = [];

  if (!deployment.templateId || deployment.templateId.trim().length === 0) {
    errors.push("invalid_template_id");
  }

  if (
    !deployment.promotionDecisionId ||
    deployment.promotionDecisionId.trim().length === 0
  ) {
    errors.push("invalid_promotion_decision_id");
  }

  if (
    !deployment.deploymentTargets ||
    deployment.deploymentTargets.length === 0
  ) {
    errors.push("no_deployment_targets");
  }

  if (
    deployment.deploymentMode &&
    !VALID_DEPLOYMENT_MODES.includes(deployment.deploymentMode)
  ) {
    errors.push("invalid_deployment_mode");
  }

  if (
    deployment.deploymentStatus &&
    !VALID_DEPLOYMENT_STATUSES.includes(deployment.deploymentStatus)
  ) {
    errors.push("invalid_deployment_status");
  }

  if (
    deployment.validationWindowMs !== undefined &&
    deployment.validationWindowMs <= 0
  ) {
    errors.push("validation_window_out_of_range");
  }

  // RULE: NO CORE PATTERN DEPLOYMENT MAY START DIRECTLY IN FULL ACTIVE MODE
  if (deployment.deploymentMode === "core_active") {
    errors.push("direct_core_active_attempt");
  }

  return errors;
}

// ============================================================================
// Deployment planning
// ============================================================================

export interface VoiceCoreDeploymentPlanInput {
  templateId: string;
  promotionDecisionId: string;
  promotionScope: VoicePromotionScope;
  promotionStatus: VoicePromotionStatus;
  targets: VoiceDeploymentTarget[];
}

/**
 * Plan a core pattern deployment based on promotion decision.
 * Pure function — determines deployment mode and validation window.
 */
export function planCoreDeployment(
  input: VoiceCoreDeploymentPlanInput,
): VoiceCorePatternDeployment {
  // Determine deployment mode based on promotion scope
  const deploymentMode: VoiceDeploymentMode = (() => {
    switch (input.promotionScope) {
      case "local_domain":
        return "limited" as const;
      case "multi_domain":
        return "staged" as const;
      case "core_global":
        return "staged" as const; // even core_global starts staged
      default:
        return "limited" as const;
    }
  })();

  // Determine validation window based on mode
  const validationWindowMs: number = (() => {
    if (deploymentMode === "limited") return 10 * 60_000; // 10 min
    if (deploymentMode === "staged") return 15 * 60_000; // 15 min
    if (deploymentMode === "shadow") return 5 * 60_000; // 5 min (future use)
    if (deploymentMode === "core_active") return 30 * 60_000; // 30 min (never reached directly)
    return 10 * 60_000;
  })();

  return {
    deploymentId: generateDeploymentId(),
    templateId: input.templateId,
    promotionDecisionId: input.promotionDecisionId,
    deploymentTargets: input.targets,
    deploymentMode,
    deploymentStatus: "prepared",
    validationWindowMs,
    createdAt: Date.now(),
  };
}

// ============================================================================
// Deployment state machine
// ============================================================================

/**
 * Start a deployment — transitions from "prepared" to "running".
 * Enforces: no direct core_active deployment.
 */
export function startDeployment(
  deployment: VoiceCorePatternDeployment,
): VoiceCorePatternDeployment {
  // RULE: NO CORE PATTERN DEPLOYMENT MAY START DIRECTLY IN FULL ACTIVE MODE
  if (deployment.deploymentMode === "core_active") {
    const err = new Error(
      "NO CORE PATTERN DEPLOYMENT MAY START DIRECTLY IN FULL ACTIVE MODE",
    );
    (err as any).code = "DIRECT_CORE_ACTIVE_ATTEMPT";
    throw err;
  }

  if (deployment.deploymentStatus !== "prepared") {
    const err = new Error(
      `Cannot start deployment in status "${deployment.deploymentStatus}". Must be "prepared".`,
    );
    (err as any).code = "INVALID_DEPLOYMENT_STATUS";
    throw err;
  }

  return {
    ...deployment,
    deploymentStatus: "running",
    startedAt: Date.now(),
  };
}

/**
 * Validate a deployment — transitions from "running" to "validated".
 */
export function confirmDeploymentValidation(
  deployment: VoiceCorePatternDeployment,
): VoiceCorePatternDeployment {
  if (deployment.deploymentStatus !== "running") {
    const err = new Error(
      `Cannot validate deployment in status "${deployment.deploymentStatus}". Must be "running".`,
    );
    (err as any).code = "INVALID_DEPLOYMENT_STATUS";
    throw err;
  }

  return {
    ...deployment,
    deploymentStatus: "validated",
    validatedAt: Date.now(),
  };
}

/**
 * Roll back a deployment — transitions to "rolled_back".
 */
export function rollbackDeployment(
  deployment: VoiceCorePatternDeployment,
  reason: string,
): VoiceCorePatternDeployment {
  return {
    ...deployment,
    deploymentStatus: "rolled_back",
    rolledBackAt: Date.now(),
    failedReason: reason,
  };
}

/**
 * Mark deployment as failed.
 */
export function failDeployment(
  deployment: VoiceCorePatternDeployment,
  reason: string,
): VoiceCorePatternDeployment {
  return {
    ...deployment,
    deploymentStatus: "failed",
    failedReason: reason,
  };
}

/**
 * Promote deployment to core_active after successful validation.
 * Only allowed from "validated" status.
 */
export function promoteToCoreActive(
  deployment: VoiceCorePatternDeployment,
): VoiceCorePatternDeployment {
  if (deployment.deploymentStatus !== "validated") {
    const err = new Error(
      `Cannot promote to core_active from status "${deployment.deploymentStatus}". Must be "validated".`,
    );
    (err as any).code = "INVALID_DEPLOYMENT_STATUS";
    throw err;
  }

  return {
    ...deployment,
    deploymentMode: "core_active",
    deploymentStatus: "running",
  };
}

// ============================================================================
// Deployment registry
// ============================================================================

export interface VoiceDeploymentRegistry {
  deployments: Map<string, VoiceCorePatternDeployment>;
  maxDeployments: number;
}

const DEFAULT_DEPLOYMENT_MAX = 100;

let _deploymentRegistry: VoiceDeploymentRegistry = {
  deployments: new Map(),
  maxDeployments: DEFAULT_DEPLOYMENT_MAX,
};

export function registerDeployment(
  deployment: VoiceCorePatternDeployment,
): void {
  if (_deploymentRegistry.deployments.size >= _deploymentRegistry.maxDeployments) {
    throw new Error(
      `Deployment registry full (max ${_deploymentRegistry.maxDeployments}). Cannot register ${deployment.deploymentId}`,
    );
  }
  _deploymentRegistry.deployments.set(deployment.deploymentId, deployment);
}

export function getDeployment(
  deploymentId: string,
): VoiceCorePatternDeployment | undefined {
  return _deploymentRegistry.deployments.get(deploymentId);
}

export function getDeploymentsForTemplate(
  templateId: string,
): VoiceCorePatternDeployment[] {
  return Array.from(_deploymentRegistry.deployments.values()).filter(
    (d) => d.templateId === templateId,
  );
}

export function getRunningDeployments(): VoiceCorePatternDeployment[] {
  return Array.from(_deploymentRegistry.deployments.values()).filter(
    (d) => d.deploymentStatus === "running",
  );
}

export function getValidatedDeployments(): VoiceCorePatternDeployment[] {
  return Array.from(_deploymentRegistry.deployments.values()).filter(
    (d) => d.deploymentStatus === "validated",
  );
}

export function getRolledBackDeployments(): VoiceCorePatternDeployment[] {
  return Array.from(_deploymentRegistry.deployments.values()).filter(
    (d) => d.deploymentStatus === "rolled_back",
  );
}

export function getAllDeployments(): VoiceCorePatternDeployment[] {
  return Array.from(_deploymentRegistry.deployments.values());
}

export function removeDeployment(deploymentId: string): boolean {
  return _deploymentRegistry.deployments.delete(deploymentId);
}

export function clearDeploymentRegistry(): void {
  _deploymentRegistry = {
    deployments: new Map(),
    maxDeployments: DEFAULT_DEPLOYMENT_MAX,
  };
}

export function setDeploymentRegistryForTest(
  registry: VoiceDeploymentRegistry,
): void {
  _deploymentRegistry = registry;
}

// ============================================================================
// Deployment readiness check
// ============================================================================

export interface VoiceDeploymentReadinessCheck {
  deploymentId: string;
  ready: boolean;
  blockingReasons: string[];
  elapsedMs?: number;
  validationWindowMs?: number;
}

/**
 * Check if a deployment is ready to be promoted based on validation window.
 */
export function checkDeploymentReadiness(
  deploymentId: string,
): VoiceDeploymentReadinessCheck {
  const deployment = getDeployment(deploymentId);

  if (!deployment) {
    return {
      deploymentId,
      ready: false,
      blockingReasons: [`Deployment ${deploymentId} not found`],
    };
  }

  const blockingReasons: string[] = [];

  if (deployment.deploymentStatus !== "running") {
    blockingReasons.push(
      `Deployment status is "${deployment.deploymentStatus}", not "running"`,
    );
  }

  if (!deployment.startedAt) {
    blockingReasons.push("Deployment has not been started");
  } else {
    const elapsedMs = Date.now() - deployment.startedAt;
    if (elapsedMs < deployment.validationWindowMs) {
      const remainingMs = deployment.validationWindowMs - elapsedMs;
      blockingReasons.push(
        `Validation window not yet passed: ${Math.round(remainingMs / 1000)}s remaining`,
      );
    }
  }

  return {
    deploymentId,
    ready: blockingReasons.length === 0,
    blockingReasons,
    elapsedMs: deployment.startedAt
      ? Date.now() - deployment.startedAt
      : undefined,
    validationWindowMs: deployment.validationWindowMs,
  };
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceCorePatternDeployment(
  deployment: VoiceCorePatternDeployment,
): string {
  const modeEmoji: Record<VoiceDeploymentMode, string> = {
    shadow: "👤",
    limited: "📍",
    staged: "📈",
    core_active: "🏛️",
  };

  const statusEmoji: Record<VoiceDeploymentStatus, string> = {
    prepared: "📋",
    running: "▶️",
    validated: "✅",
    rolled_back: "↩️",
    failed: "❌",
  };

  const lines = [
    `🚀 Voice Core Pattern Deployment`,
    `• deployment ID: ${deployment.deploymentId}`,
    `• template ID: ${deployment.templateId}`,
    `• promotion decision ID: ${deployment.promotionDecisionId}`,
    `• mode: ${modeEmoji[deployment.deploymentMode]} ${deployment.deploymentMode}`,
    `• status: ${statusEmoji[deployment.deploymentStatus]} ${deployment.deploymentStatus}`,
    `• validation window: ${Math.round(deployment.validationWindowMs / 1000)}s`,
    `• targets: ${deployment.deploymentTargets.map((t) => `${t.targetType}:${t.targetId}`).join(", ")}`,
    deployment.startedAt
      ? `• started at: ${new Date(deployment.startedAt).toISOString()}`
      : null,
    deployment.validatedAt
      ? `• validated at: ${new Date(deployment.validatedAt).toISOString()}`
      : null,
    deployment.rolledBackAt
      ? `• rolled back at: ${new Date(deployment.rolledBackAt).toISOString()}`
      : null,
    deployment.failedReason
      ? `• failed reason: ${deployment.failedReason}`
      : null,
    `• created at: ${new Date(deployment.createdAt).toISOString()}`,
  ];

  return lines.filter(Boolean).join("\n");
}
