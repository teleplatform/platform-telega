// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Builtin Contract
//
// Production-grade temporal conversational loop for voice surface.
// Entry, acknowledge, pause, clarify, interruption, continuation,
// closure, memory — all bounded, live, recoverable.
// ─────────────────────────────────────────────────────────────

import type { VoiceInteractionLoopContract } from "./types.js";
import {
  buildLoopContract,
  buildEntryBehavior,
  buildAcknowledgeBehavior,
  buildPauseBehavior,
  buildClarifyBehavior,
  buildInterruptionLoop,
  buildContinuationBehavior,
  buildClosureBehavior,
  buildMemoryBehavior,
} from "./contracts.js";
import { setVoiceLoopContract } from "./selectors.js";

export const voiceLoopContract: VoiceInteractionLoopContract = buildLoopContract({
  version: "1.0.0",
  entryBehavior: buildEntryBehavior({
    requiresWarmStart: true,
    entryShouldBeShort: true,
    maxEntrySentences: 2,
    avoidSystemicGreetingSpam: true,
  }),
  acknowledgeBehavior: buildAcknowledgeBehavior({
    acknowledgeBeforeLongerThinking: true,
    maxAcknowledgeWords: 4,
    supportsLiveHoldingPhrase: true,
    avoidMechanicalAcknowledgements: true,
  }),
  pauseBehavior: buildPauseBehavior({
    allowsMicroPause: true,
    allowsThinkingPause: true,
    maxHoldingPhraseWords: 4,
    preferShortPauseOverLongExplanation: true,
  }),
  clarifyBehavior: buildClarifyBehavior({
    clarifyOnLowConfidence: true,
    clarifyOnProtectedMeaning: true,
    maxClarificationsPerTurn: 1,
    preferSingleClarifyingQuestion: true,
  }),
  interruptionBehavior: buildInterruptionLoop({
    supportsBargeIn: true,
    stopCurrentTurnOnInterrupt: true,
    recoverSoftly: true,
    maxRecoverySentences: 2,
    restateOnlyMinimalContext: true,
  }),
  continuationBehavior: buildContinuationBehavior({
    supportsMultiTurn: true,
    continueOnlyIfContextFresh: true,
    maxSequentialTurnsWithoutUserReset: 3,
    preferOneNextStepAtATime: true,
  }),
  closureBehavior: buildClosureBehavior({
    supportsSoftClosure: true,
    avoidAbruptEndings: true,
    avoidOverFriendlyFarewellSpam: true,
    maxClosureSentences: 2,
  }),
  memoryBehavior: buildMemoryBehavior({
    remembersImmediateTurnContext: true,
    remembersShortSessionContext: true,
    maxContextCarryTurns: 5,
    dropStaleContextGracefully: true,
  }),
  notes: [
    "Voice interaction = loop, not single response",
    "Entry is warm, short, recognizing",
    "Acknowledge before longer thinking",
    "Short living pauses, no mechanical placeholders",
    "One clarification question at a time",
    "Barge-in supported, soft recovery",
    "Multi-turn bounded to 3 sequential turns",
    "Soft closure, no over-friendly spam",
    "Short conversation memory (5 turns), graceful drop",
  ],
});

// Auto-register
setVoiceLoopContract(voiceLoopContract);
