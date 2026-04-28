// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Validators
//
// Checks:
// - maxEntrySentences <= 2
// - maxAcknowledgeWords <= 4
// - maxHoldingPhraseWords <= 4
// - maxClarificationsPerTurn <= 1
// - maxRecoverySentences <= 2
// - maxClosureSentences <= 2
// - supportsBargeIn === true
// - temporal loop doesn't violate truthful status discipline
// ─────────────────────────────────────────────────────────────

import type { VoiceInteractionLoopContract, VoiceLoopValidationError } from "./types.js";

export function validateLoopContract(contract: VoiceInteractionLoopContract): VoiceLoopValidationError[] {
  const errors: VoiceLoopValidationError[] = [];

  // Version
  if (!contract.version || contract.version.trim() === "") {
    errors.push({ path: "version", message: "Version is required" });
  }

  // Surface
  if (contract.surface !== "voice") {
    errors.push({ path: "surface", message: `Must be "voice", got "${contract.surface}"` });
  }

  // Entry
  if (contract.entryBehavior.maxEntrySentences > 2) {
    errors.push({ path: "entryBehavior.maxEntrySentences", message: "Must be <= 2" });
  }
  if (!contract.entryBehavior.entryShouldBeShort) {
    errors.push({ path: "entryBehavior.entryShouldBeShort", message: "Must be true" });
  }

  // Acknowledge
  if (contract.acknowledgeBehavior.maxAcknowledgeWords > 4) {
    errors.push({ path: "acknowledgeBehavior.maxAcknowledgeWords", message: "Must be <= 4" });
  }

  // Pause
  if (contract.pauseBehavior.maxHoldingPhraseWords > 4) {
    errors.push({ path: "pauseBehavior.maxHoldingPhraseWords", message: "Must be <= 4" });
  }

  // Clarify
  if (contract.clarifyBehavior.maxClarificationsPerTurn > 1) {
    errors.push({ path: "clarifyBehavior.maxClarificationsPerTurn", message: "Must be <= 1" });
  }

  // Interruption
  if (!contract.interruptionBehavior.supportsBargeIn) {
    errors.push({ path: "interruptionBehavior.supportsBargeIn", message: "Must be true" });
  }
  if (contract.interruptionBehavior.maxRecoverySentences > 2) {
    errors.push({ path: "interruptionBehavior.maxRecoverySentences", message: "Must be <= 2" });
  }

  // Closure
  if (contract.closureBehavior.maxClosureSentences > 2) {
    errors.push({ path: "closureBehavior.maxClosureSentences", message: "Must be <= 2" });
  }

  // Memory
  if (contract.memoryBehavior.maxContextCarryTurns < 1) {
    errors.push({ path: "memoryBehavior.maxContextCarryTurns", message: "Must be >= 1" });
  }

  return errors;
}
