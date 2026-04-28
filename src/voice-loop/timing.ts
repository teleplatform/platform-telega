// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Timing Rules
//
// Entry: very short
// Acknowledge: almost instant
// Clarification: one short question
// Continuation: short bounded turns
// Closure: 1 short closing phrase max
// ─────────────────────────────────────────────────────────────

import type { VoiceInteractionLoopContract } from "./types.js";

export function getTimingProfile(contract: VoiceInteractionLoopContract) {
  return {
    entry: {
      maxSentences: contract.entryBehavior.maxEntrySentences,
      shouldBeShort: contract.entryBehavior.entryShouldBeShort,
    },
    acknowledge: {
      maxWords: contract.acknowledgeBehavior.maxAcknowledgeWords,
      beforeLongerThinking: contract.acknowledgeBehavior.acknowledgeBeforeLongerThinking,
    },
    pause: {
      allowsMicroPause: contract.pauseBehavior.allowsMicroPause,
      allowsThinkingPause: contract.pauseBehavior.allowsThinkingPause,
      maxWords: contract.pauseBehavior.maxHoldingPhraseWords,
    },
    clarify: {
      maxPerTurn: contract.clarifyBehavior.maxClarificationsPerTurn,
      singleQuestionOnly: contract.clarifyBehavior.preferSingleClarifyingQuestion,
    },
    continuation: {
      supportsMultiTurn: contract.continuationBehavior.supportsMultiTurn,
      maxSequentialTurns: contract.continuationBehavior.maxSequentialTurnsWithoutUserReset,
    },
    closure: {
      maxSentences: contract.closureBehavior.maxClosureSentences,
      supportsSoftClosure: contract.closureBehavior.supportsSoftClosure,
    },
  };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function countSentences(text: string): number {
  const matches = text.match(/[.!?]+/g);
  return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
}
