// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Contract Helpers
// ─────────────────────────────────────────────────────────────

import type {
  VoiceSurfaceResponseContract,
  VoiceSurfaceId,
  ResponseShapeContract,
  TurnTakingContract,
  LatencyBehaviorContract,
  TruthBehaviorContract,
  InterruptionBehaviorContract,
  SurfaceFallbackBehaviorContract,
} from "./types.js";

export function buildResponseShape(input: {
  defaultLength: "short" | "medium";
  maxSentences: number;
  maxPrimaryIdeas: number;
  allowsStructuredExpansion: boolean;
  prefersSingleNextStep: boolean;
}): ResponseShapeContract {
  return {
    defaultLength: input.defaultLength,
    maxSentences: input.maxSentences,
    maxPrimaryIdeas: input.maxPrimaryIdeas,
    allowsStructuredExpansion: input.allowsStructuredExpansion,
    prefersSingleNextStep: input.prefersSingleNextStep,
  };
}

export function buildTurnTaking(input: {
  prefersImmediateAnswer: boolean;
  clarifyBeforeAction: boolean;
  clarifyBeforeProtectedMeaning: boolean;
  allowsFollowupPrompt: boolean;
  followupPromptMaxCount: number;
}): TurnTakingContract {
  return {
    prefersImmediateAnswer: input.prefersImmediateAnswer,
    clarifyBeforeAction: input.clarifyBeforeAction,
    clarifyBeforeProtectedMeaning: input.clarifyBeforeProtectedMeaning,
    allowsFollowupPrompt: input.allowsFollowupPrompt,
    followupPromptMaxCount: input.followupPromptMaxCount,
  };
}

export function buildLatencyBehavior(input: {
  supportsShortHoldingPhrase: boolean;
  holdingPhraseMaxWords: number;
  allowsProgressiveResponse: boolean;
  prefersFastAcknowledgeThenAnswer: boolean;
}): LatencyBehaviorContract {
  return {
    supportsShortHoldingPhrase: input.supportsShortHoldingPhrase,
    holdingPhraseMaxWords: input.holdingPhraseMaxWords,
    allowsProgressiveResponse: input.allowsProgressiveResponse,
    prefersFastAcknowledgeThenAnswer: input.prefersFastAcknowledgeThenAnswer,
  };
}

export function buildTruthBehavior(input: {
  forbidFakeCompletion: boolean;
  forbidPreparedAsExecuted: boolean;
  forbidHandoffAsDelivered: boolean;
  requireTruthfulStatusLanguage: boolean;
  preferExplicitBlockedExplanation: boolean;
}): TruthBehaviorContract {
  return {
    forbidFakeCompletion: input.forbidFakeCompletion,
    forbidPreparedAsExecuted: input.forbidPreparedAsExecuted,
    forbidHandoffAsDelivered: input.forbidHandoffAsDelivered,
    requireTruthfulStatusLanguage: input.requireTruthfulStatusLanguage,
    preferExplicitBlockedExplanation: input.preferExplicitBlockedExplanation,
  };
}

export function buildInterruptionBehavior(input: {
  supportsInterruption: boolean;
  restartSoftlyAfterInterruption: boolean;
  restateContextBriefly: boolean;
  maxRecoverySentences: number;
}): InterruptionBehaviorContract {
  return {
    supportsInterruption: input.supportsInterruption,
    restartSoftlyAfterInterruption: input.restartSoftlyAfterInterruption,
    restateContextBriefly: input.restateContextBriefly,
    maxRecoverySentences: input.maxRecoverySentences,
  };
}

export function buildFallbackBehavior(input: {
  fallbackToTextAllowed: boolean;
  fallbackToShortAnswerAllowed: boolean;
  fallbackToClarificationAllowed: boolean;
  fallbackToEnglishAllowed: boolean;
}): SurfaceFallbackBehaviorContract {
  return {
    fallbackToTextAllowed: input.fallbackToTextAllowed,
    fallbackToShortAnswerAllowed: input.fallbackToShortAnswerAllowed,
    fallbackToClarificationAllowed: input.fallbackToClarificationAllowed,
    fallbackToEnglishAllowed: input.fallbackToEnglishAllowed,
  };
}

export function buildSurfaceContract(input: {
  surface: VoiceSurfaceId;
  version: string;
  responseShape: ResponseShapeContract;
  turnTaking: TurnTakingContract;
  latencyBehavior: LatencyBehaviorContract;
  truthBehavior: TruthBehaviorContract;
  interruptionBehavior: InterruptionBehaviorContract;
  fallbackBehavior: SurfaceFallbackBehaviorContract;
  notes?: string[];
}): VoiceSurfaceResponseContract {
  return {
    surface: input.surface,
    version: input.version,
    responseShape: input.responseShape,
    turnTaking: input.turnTaking,
    latencyBehavior: input.latencyBehavior,
    truthBehavior: input.truthBehavior,
    interruptionBehavior: input.interruptionBehavior,
    fallbackBehavior: input.fallbackBehavior,
    notes: input.notes,
  };
}
