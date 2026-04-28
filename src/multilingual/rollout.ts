// ─────────────────────────────────────────────────────────────
// MULTILINGUAL LANGUAGE PACK CONTRACT v1.0 — Rollout Config
//
// Feature flags + staged rollout + per-surface + per-role control
// ─────────────────────────────────────────────────────────────

import type { LanguageRolloutConfig, LanguageRollbackConfig, FeatureFlagCheckInput } from "./types.js";
import { LanguageRolloutBlockedError, LanguagePackInvalidError } from "./errors.js";

const VALID_ROLLOUT_STAGES = new Set([
  "off",
  "internal",
  "creator_only",
  "limited_users",
  "production",
] as const);

export function buildRolloutConfig(input: {
  featureFlag: string;
  enabledSurfaces: string[];
  enabledRoles: LanguageRolloutConfig["enabledRoles"];
  rolloutStage: LanguageRolloutConfig["rolloutStage"];
}): LanguageRolloutConfig {
  if (!input.featureFlag || input.featureFlag.trim() === "") {
    throw new LanguagePackInvalidError("featureFlag is required");
  }
  if (!input.enabledSurfaces || input.enabledSurfaces.length === 0) {
    throw new LanguagePackInvalidError("enabledSurfaces is required");
  }
  if (!input.enabledRoles || input.enabledRoles.length === 0) {
    throw new LanguagePackInvalidError("enabledRoles is required");
  }
  if (!VALID_ROLLOUT_STAGES.has(input.rolloutStage)) {
    throw new LanguagePackInvalidError(
      `Invalid rolloutStage: ${input.rolloutStage}. Must be one of: ${Array.from(VALID_ROLLOUT_STAGES).join(", ")}`,
    );
  }

  return {
    featureFlag: input.featureFlag,
    enabledSurfaces: input.enabledSurfaces,
    enabledRoles: input.enabledRoles,
    rolloutStage: input.rolloutStage,
  };
}

export function buildRollbackConfig(input?: {
  instantDisable?: boolean;
  disableBySurface?: boolean;
  disableByRole?: boolean;
  fallbackLanguage?: "en";
  rollbackNotes?: string[];
}): LanguageRollbackConfig {
  return {
    instantDisable: input?.instantDisable ?? true,
    disableBySurface: input?.disableBySurface ?? true,
    disableByRole: input?.disableByRole ?? true,
    fallbackLanguage: "en",
    rollbackNotes: input?.rollbackNotes,
  };
}

export function isLanguageEnabledFor(
  config: LanguageRolloutConfig,
  input: FeatureFlagCheckInput,
): boolean {
  // Check rollout stage
  if (config.rolloutStage === "off") return false;

  // Check surface
  if (!config.enabledSurfaces.includes(input.surface)) {
    return false;
  }

  // Check role
  if (!config.enabledRoles.includes(input.role)) {
    return false;
  }

  // Stage-specific checks
  if (config.rolloutStage === "creator_only" && input.role !== "creator") {
    return false;
  }

  return true;
}

export function assertLanguageEnabledFor(
  config: LanguageRolloutConfig,
  input: FeatureFlagCheckInput,
): void {
  if (!isLanguageEnabledFor(config, input)) {
    throw new LanguageRolloutBlockedError(input.languageCode, input.surface, input.role);
  }
}

export function getRolloutStageDescription(stage: LanguageRolloutConfig["rolloutStage"]): string {
  switch (stage) {
    case "off":
      return "Language is disabled";
    case "internal":
      return "Language is available for internal testing only";
    case "creator_only":
      return "Language is available for creators only";
    case "limited_users":
      return "Language is available for a limited set of users";
    case "production":
      return "Language is fully available for all users";
    default:
      return `Unknown rollout stage: ${stage}`;
  }
}
