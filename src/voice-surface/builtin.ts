// ─────────────────────────────────────────────────────────────
// VOICE SURFACE RESPONSE CONTRACT v1.0 — Builtin Contracts
//
// Production-grade response contracts for: web, tgm, telegram, voice.
// Each surface has distinct response shape, turn-taking, latency,
// truth, interruption, and fallback behavior.
// ─────────────────────────────────────────────────────────────

import type { VoiceSurfaceResponseContract } from "./types.js";
import { buildSurfaceContract, buildResponseShape, buildTurnTaking, buildLatencyBehavior, buildTruthBehavior, buildInterruptionBehavior, buildFallbackBehavior } from "./contracts.js";

// ── Web ──
// Slightly denser, structured, explanation-friendly but not lecture-length.
export const webContract: VoiceSurfaceResponseContract = buildSurfaceContract({
  surface: "web",
  version: "1.0.0",
  responseShape: buildResponseShape({
    defaultLength: "medium",
    maxSentences: 5,
    maxPrimaryIdeas: 3,
    allowsStructuredExpansion: true,
    prefersSingleNextStep: true,
  }),
  turnTaking: buildTurnTaking({
    prefersImmediateAnswer: true,
    clarifyBeforeAction: true,
    clarifyBeforeProtectedMeaning: true,
    allowsFollowupPrompt: true,
    followupPromptMaxCount: 1,
  }),
  latencyBehavior: buildLatencyBehavior({
    supportsShortHoldingPhrase: true,
    holdingPhraseMaxWords: 5,
    allowsProgressiveResponse: true,
    prefersFastAcknowledgeThenAnswer: true,
  }),
  truthBehavior: buildTruthBehavior({
    forbidFakeCompletion: true,
    forbidPreparedAsExecuted: true,
    forbidHandoffAsDelivered: true,
    requireTruthfulStatusLanguage: true,
    preferExplicitBlockedExplanation: true,
  }),
  interruptionBehavior: buildInterruptionBehavior({
    supportsInterruption: true,
    restartSoftlyAfterInterruption: true,
    restateContextBriefly: true,
    maxRecoverySentences: 2,
  }),
  fallbackBehavior: buildFallbackBehavior({
    fallbackToTextAllowed: true,
    fallbackToShortAnswerAllowed: true,
    fallbackToClarificationAllowed: true,
    fallbackToEnglishAllowed: true,
  }),
  notes: [
    "Slightly denser than other surfaces",
    "Allows structured expansion up to 3 ideas",
    "Progressive response supported",
  ],
});

// ── TGM ──
// Chat-native, short, fast, one main idea per turn.
export const tgmContract: VoiceSurfaceResponseContract = buildSurfaceContract({
  surface: "tgm",
  version: "1.0.0",
  responseShape: buildResponseShape({
    defaultLength: "short",
    maxSentences: 4,
    maxPrimaryIdeas: 2,
    allowsStructuredExpansion: false,
    prefersSingleNextStep: true,
  }),
  turnTaking: buildTurnTaking({
    prefersImmediateAnswer: true,
    clarifyBeforeAction: true,
    clarifyBeforeProtectedMeaning: true,
    allowsFollowupPrompt: false,
    followupPromptMaxCount: 0,
  }),
  latencyBehavior: buildLatencyBehavior({
    supportsShortHoldingPhrase: true,
    holdingPhraseMaxWords: 4,
    allowsProgressiveResponse: false,
    prefersFastAcknowledgeThenAnswer: true,
  }),
  truthBehavior: buildTruthBehavior({
    forbidFakeCompletion: true,
    forbidPreparedAsExecuted: true,
    forbidHandoffAsDelivered: true,
    requireTruthfulStatusLanguage: true,
    preferExplicitBlockedExplanation: true,
  }),
  interruptionBehavior: buildInterruptionBehavior({
    supportsInterruption: true,
    restartSoftlyAfterInterruption: true,
    restateContextBriefly: true,
    maxRecoverySentences: 2,
  }),
  fallbackBehavior: buildFallbackBehavior({
    fallbackToTextAllowed: true,
    fallbackToShortAnswerAllowed: true,
    fallbackToClarificationAllowed: true,
    fallbackToEnglishAllowed: true,
  }),
  notes: [
    "Chat-native, short and fast",
    "One main idea per turn",
    "No progressive response",
  ],
});

// ── Telegram ──
// Very quickly scannable, short, no heavy constructions.
export const telegramContract: VoiceSurfaceResponseContract = buildSurfaceContract({
  surface: "telegram",
  version: "1.0.0",
  responseShape: buildResponseShape({
    defaultLength: "short",
    maxSentences: 3,
    maxPrimaryIdeas: 2,
    allowsStructuredExpansion: false,
    prefersSingleNextStep: true,
  }),
  turnTaking: buildTurnTaking({
    prefersImmediateAnswer: true,
    clarifyBeforeAction: true,
    clarifyBeforeProtectedMeaning: true,
    allowsFollowupPrompt: false,
    followupPromptMaxCount: 0,
  }),
  latencyBehavior: buildLatencyBehavior({
    supportsShortHoldingPhrase: true,
    holdingPhraseMaxWords: 4,
    allowsProgressiveResponse: false,
    prefersFastAcknowledgeThenAnswer: true,
  }),
  truthBehavior: buildTruthBehavior({
    forbidFakeCompletion: true,
    forbidPreparedAsExecuted: true,
    forbidHandoffAsDelivered: true,
    requireTruthfulStatusLanguage: true,
    preferExplicitBlockedExplanation: true,
  }),
  interruptionBehavior: buildInterruptionBehavior({
    supportsInterruption: false,
    restartSoftlyAfterInterruption: false,
    restateContextBriefly: false,
    maxRecoverySentences: 1,
  }),
  fallbackBehavior: buildFallbackBehavior({
    fallbackToTextAllowed: true,
    fallbackToShortAnswerAllowed: true,
    fallbackToClarificationAllowed: true,
    fallbackToEnglishAllowed: true,
  }),
  notes: [
    "Very short, quickly scannable",
    "No heavy constructions",
    "Strong first line required",
  ],
});

// ── Voice ──
// Shortest, most natural, safest. 1 idea + 1 confirmation + 1 next step max.
export const voiceContract: VoiceSurfaceResponseContract = buildSurfaceContract({
  surface: "voice",
  version: "1.0.0",
  responseShape: buildResponseShape({
    defaultLength: "short",
    maxSentences: 2,
    maxPrimaryIdeas: 1,
    allowsStructuredExpansion: false,
    prefersSingleNextStep: true,
  }),
  turnTaking: buildTurnTaking({
    prefersImmediateAnswer: true,
    clarifyBeforeAction: true,
    clarifyBeforeProtectedMeaning: true,
    allowsFollowupPrompt: false,
    followupPromptMaxCount: 0,
  }),
  latencyBehavior: buildLatencyBehavior({
    supportsShortHoldingPhrase: true,
    holdingPhraseMaxWords: 3,
    allowsProgressiveResponse: false,
    prefersFastAcknowledgeThenAnswer: true,
  }),
  truthBehavior: buildTruthBehavior({
    forbidFakeCompletion: true,
    forbidPreparedAsExecuted: true,
    forbidHandoffAsDelivered: true,
    requireTruthfulStatusLanguage: true,
    preferExplicitBlockedExplanation: true,
  }),
  interruptionBehavior: buildInterruptionBehavior({
    supportsInterruption: true,
    restartSoftlyAfterInterruption: true,
    restateContextBriefly: true,
    maxRecoverySentences: 1,
  }),
  fallbackBehavior: buildFallbackBehavior({
    fallbackToTextAllowed: true,
    fallbackToShortAnswerAllowed: true,
    fallbackToClarificationAllowed: true,
    fallbackToEnglishAllowed: true,
  }),
  notes: [
    "Shortest and safest surface",
    "1 idea + 1 confirmation + 1 next step maximum",
    "Voice ≠ spoken chat text",
    "No heavy syntactic nesting",
    "Must handle interruption gracefully",
  ],
});

// ── All builtin contracts ──
export const ALL_SURFACE_CONTRACTS = [
  webContract,
  tgmContract,
  telegramContract,
  voiceContract,
];
