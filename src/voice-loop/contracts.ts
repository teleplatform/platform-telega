// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Contract Builders
// ─────────────────────────────────────────────────────────────

import type {
  VoiceInteractionLoopContract,
  VoiceEntryBehaviorContract,
  VoiceAcknowledgeBehaviorContract,
  VoicePauseBehaviorContract,
  VoiceClarifyBehaviorContract,
  VoiceInterruptionLoopContract,
  VoiceContinuationBehaviorContract,
  VoiceClosureBehaviorContract,
  VoiceMemoryBehaviorContract,
} from "./types.js";

export function buildEntryBehavior(input: {
  requiresWarmStart: boolean;
  entryShouldBeShort: boolean;
  maxEntrySentences: number;
  avoidSystemicGreetingSpam: boolean;
}): VoiceEntryBehaviorContract {
  return { ...input };
}

export function buildAcknowledgeBehavior(input: {
  acknowledgeBeforeLongerThinking: boolean;
  maxAcknowledgeWords: number;
  supportsLiveHoldingPhrase: boolean;
  avoidMechanicalAcknowledgements: boolean;
}): VoiceAcknowledgeBehaviorContract {
  return { ...input };
}

export function buildPauseBehavior(input: {
  allowsMicroPause: boolean;
  allowsThinkingPause: boolean;
  maxHoldingPhraseWords: number;
  preferShortPauseOverLongExplanation: boolean;
}): VoicePauseBehaviorContract {
  return { ...input };
}

export function buildClarifyBehavior(input: {
  clarifyOnLowConfidence: boolean;
  clarifyOnProtectedMeaning: boolean;
  maxClarificationsPerTurn: number;
  preferSingleClarifyingQuestion: boolean;
}): VoiceClarifyBehaviorContract {
  return { ...input };
}

export function buildInterruptionLoop(input: {
  supportsBargeIn: boolean;
  stopCurrentTurnOnInterrupt: boolean;
  recoverSoftly: boolean;
  maxRecoverySentences: number;
  restateOnlyMinimalContext: boolean;
}): VoiceInterruptionLoopContract {
  return { ...input };
}

export function buildContinuationBehavior(input: {
  supportsMultiTurn: boolean;
  continueOnlyIfContextFresh: boolean;
  maxSequentialTurnsWithoutUserReset: number;
  preferOneNextStepAtATime: boolean;
}): VoiceContinuationBehaviorContract {
  return { ...input };
}

export function buildClosureBehavior(input: {
  supportsSoftClosure: boolean;
  avoidAbruptEndings: boolean;
  avoidOverFriendlyFarewellSpam: boolean;
  maxClosureSentences: number;
}): VoiceClosureBehaviorContract {
  return { ...input };
}

export function buildMemoryBehavior(input: {
  remembersImmediateTurnContext: boolean;
  remembersShortSessionContext: boolean;
  maxContextCarryTurns: number;
  dropStaleContextGracefully: boolean;
}): VoiceMemoryBehaviorContract {
  return { ...input };
}

export function buildLoopContract(input: {
  version: string;
  entryBehavior: VoiceEntryBehaviorContract;
  acknowledgeBehavior: VoiceAcknowledgeBehaviorContract;
  pauseBehavior: VoicePauseBehaviorContract;
  clarifyBehavior: VoiceClarifyBehaviorContract;
  interruptionBehavior: VoiceInterruptionLoopContract;
  continuationBehavior: VoiceContinuationBehaviorContract;
  closureBehavior: VoiceClosureBehaviorContract;
  memoryBehavior: VoiceMemoryBehaviorContract;
  notes?: string[];
}): VoiceInteractionLoopContract {
  return {
    version: input.version,
    surface: "voice",
    entryBehavior: input.entryBehavior,
    acknowledgeBehavior: input.acknowledgeBehavior,
    pauseBehavior: input.pauseBehavior,
    clarifyBehavior: input.clarifyBehavior,
    interruptionBehavior: input.interruptionBehavior,
    continuationBehavior: input.continuationBehavior,
    closureBehavior: input.closureBehavior,
    memoryBehavior: input.memoryBehavior,
    notes: input.notes,
  };
}
