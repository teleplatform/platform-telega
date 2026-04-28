// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Validators
//
// Checks:
// - all 4 surfaces present
// - all sub-contracts complete
// - voice.maxSentences <= 2
// - voice.maxPrimaryIdeas <= 1
// - telegram.defaultLength === "short"
// - truthBehavior.forbidFakeCompletion === true everywhere
// - fallback behavior complete everywhere
// ─────────────────────────────────────────────────────────────

import type {
  VoiceSurfaceResponseContract,
  VoiceSurfaceId,
  VoiceSurfaceValidationError,
} from "./types.js";

const REQUIRED_SURFACES: VoiceSurfaceId[] = ["web", "tgm", "telegram", "voice"];

export function validateContract(contract: VoiceSurfaceResponseContract): VoiceSurfaceValidationError[] {
  const errors: VoiceSurfaceValidationError[] = [];

  // Surface identity
  if (!contract.surface || !REQUIRED_SURFACES.includes(contract.surface)) {
    errors.push({ path: "surface", message: `Invalid surface: ${contract.surface}` });
  }

  // Version
  if (!contract.version || contract.version.trim() === "") {
    errors.push({ path: "version", message: "Version is required" });
  }

  // Response shape
  if (!contract.responseShape) {
    errors.push({ path: "responseShape", message: "Response shape is required" });
  } else {
    if (contract.responseShape.maxSentences < 1) {
      errors.push({ path: "responseShape.maxSentences", message: "Must be >= 1" });
    }
    if (contract.responseShape.maxPrimaryIdeas < 1) {
      errors.push({ path: "responseShape.maxPrimaryIdeas", message: "Must be >= 1" });
    }
  }

  // Voice-specific limits
  if (contract.surface === "voice") {
    if (contract.responseShape.maxSentences > 2) {
      errors.push({ path: "responseShape.maxSentences", message: "Voice maxSentences must be <= 2" });
    }
    if (contract.responseShape.maxPrimaryIdeas > 1) {
      errors.push({ path: "responseShape.maxPrimaryIdeas", message: "Voice maxPrimaryIdeas must be <= 1" });
    }
  }

  // Telegram must be short
  if (contract.surface === "telegram" && contract.responseShape.defaultLength !== "short") {
    errors.push({ path: "responseShape.defaultLength", message: "Telegram defaultLength must be 'short'" });
  }

  // Turn-taking
  if (!contract.turnTaking) {
    errors.push({ path: "turnTaking", message: "Turn taking is required" });
  }

  // Latency
  if (!contract.latencyBehavior) {
    errors.push({ path: "latencyBehavior", message: "Latency behavior is required" });
  }

  // Truth behavior — forbidFakeCompletion must be true everywhere
  if (!contract.truthBehavior) {
    errors.push({ path: "truthBehavior", message: "Truth behavior is required" });
  } else {
    if (contract.truthBehavior.forbidFakeCompletion !== true) {
      errors.push({ path: "truthBehavior.forbidFakeCompletion", message: "Must be true on all surfaces" });
    }
    if (contract.truthBehavior.forbidPreparedAsExecuted !== true) {
      errors.push({ path: "truthBehavior.forbidPreparedAsExecuted", message: "Must be true on all surfaces" });
    }
    if (contract.truthBehavior.forbidHandoffAsDelivered !== true) {
      errors.push({ path: "truthBehavior.forbidHandoffAsDelivered", message: "Must be true on all surfaces" });
    }
  }

  // Interruption
  if (!contract.interruptionBehavior) {
    errors.push({ path: "interruptionBehavior", message: "Interruption behavior is required" });
  }

  // Fallback
  if (!contract.fallbackBehavior) {
    errors.push({ path: "fallbackBehavior", message: "Fallback behavior is required" });
  } else {
    if (typeof contract.fallbackBehavior.fallbackToTextAllowed !== "boolean") {
      errors.push({ path: "fallbackBehavior.fallbackToTextAllowed", message: "Must be boolean" });
    }
    if (typeof contract.fallbackBehavior.fallbackToShortAnswerAllowed !== "boolean") {
      errors.push({ path: "fallbackBehavior.fallbackToShortAnswerAllowed", message: "Must be boolean" });
    }
  }

  return errors;
}

export function validateAllContracts(contracts: VoiceSurfaceResponseContract[]): Map<VoiceSurfaceId, VoiceSurfaceValidationError[]> {
  const results = new Map<VoiceSurfaceId, VoiceSurfaceValidationError[]>();

  for (const contract of contracts) {
    const errors = validateContract(contract);
    results.set(contract.surface, errors);
  }

  return results;
}
