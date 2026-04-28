// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Persona Entry, Multilingual Strategy, Stability Architecture,
//             Language Pack Contract, Voice UX Pack, Arisha UX Files
//
// CORE DECISION: Same persona, different response contract per surface.
// Voice ≠ spoken chat text. No fake completion. Voice = shortest + safest.
// ─────────────────────────────────────────────────────────────

export type VoiceSurfaceId = "web" | "tgm" | "telegram" | "voice";

// -- First-class object --
export type VoiceSurfaceResponseContract = {
  surface: VoiceSurfaceId;
  version: string;

  responseShape: ResponseShapeContract;
  turnTaking: TurnTakingContract;
  latencyBehavior: LatencyBehaviorContract;
  truthBehavior: TruthBehaviorContract;
  interruptionBehavior: InterruptionBehaviorContract;
  fallbackBehavior: SurfaceFallbackBehaviorContract;

  notes?: string[];
};

// -- Response shape --
export type ResponseShapeContract = {
  defaultLength: "short" | "medium";
  maxSentences: number;
  maxPrimaryIdeas: number;
  allowsStructuredExpansion: boolean;
  prefersSingleNextStep: boolean;
};

// -- Turn-taking --
export type TurnTakingContract = {
  prefersImmediateAnswer: boolean;
  clarifyBeforeAction: boolean;
  clarifyBeforeProtectedMeaning: boolean;
  allowsFollowupPrompt: boolean;
  followupPromptMaxCount: number;
};

// -- Latency behavior --
export type LatencyBehaviorContract = {
  supportsShortHoldingPhrase: boolean;
  holdingPhraseMaxWords: number;
  allowsProgressiveResponse: boolean;
  prefersFastAcknowledgeThenAnswer: boolean;
};

// -- Truth behavior --
export type TruthBehaviorContract = {
  forbidFakeCompletion: boolean;
  forbidPreparedAsExecuted: boolean;
  forbidHandoffAsDelivered: boolean;
  requireTruthfulStatusLanguage: boolean;
  preferExplicitBlockedExplanation: boolean;
};

// -- Interruption behavior --
export type InterruptionBehaviorContract = {
  supportsInterruption: boolean;
  restartSoftlyAfterInterruption: boolean;
  restateContextBriefly: boolean;
  maxRecoverySentences: number;
};

// -- Surface fallback --
export type SurfaceFallbackBehaviorContract = {
  fallbackToTextAllowed: boolean;
  fallbackToShortAnswerAllowed: boolean;
  fallbackToClarificationAllowed: boolean;
  fallbackToEnglishAllowed: boolean;
};

// -- ValidationError --
export type VoiceSurfaceValidationError = {
  path: string;
  message: string;
};

// -- Holding phrases --
export type HoldingPhraseBank = {
  ru: string[];
  en: string[];
  uz: string[];
};

// -- Shaping result --
export type ShapedResponse = {
  text: string;
  sentenceCount: number;
  truncated: boolean;
  surface: VoiceSurfaceId;
};
