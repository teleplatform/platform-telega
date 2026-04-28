// ─────────────────────────────────────────────────────────────
// VOICE INTERACTION LOOP CONTRACT v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Voice Surface Response Contract v1.0 + all prior layers
//
// CORE DECISION: Voice interaction = loop, not single response.
// listen → detect intent confidence → acknowledge → decide loop step
// → speak bounded turn → wait / recover / continue
// ─────────────────────────────────────────────────────────────

// -- First-class object --
export type VoiceInteractionLoopContract = {
  version: string;
  surface: "voice";

  entryBehavior: VoiceEntryBehaviorContract;
  acknowledgeBehavior: VoiceAcknowledgeBehaviorContract;
  pauseBehavior: VoicePauseBehaviorContract;
  clarifyBehavior: VoiceClarifyBehaviorContract;
  interruptionBehavior: VoiceInterruptionLoopContract;
  continuationBehavior: VoiceContinuationBehaviorContract;
  closureBehavior: VoiceClosureBehaviorContract;
  memoryBehavior: VoiceMemoryBehaviorContract;

  notes?: string[];
};

// -- Entry behavior --
export type VoiceEntryBehaviorContract = {
  requiresWarmStart: boolean;
  entryShouldBeShort: boolean;
  maxEntrySentences: number;
  avoidSystemicGreetingSpam: boolean;
};

// -- Acknowledge behavior --
export type VoiceAcknowledgeBehaviorContract = {
  acknowledgeBeforeLongerThinking: boolean;
  maxAcknowledgeWords: number;
  supportsLiveHoldingPhrase: boolean;
  avoidMechanicalAcknowledgements: boolean;
};

// -- Pause behavior --
export type VoicePauseBehaviorContract = {
  allowsMicroPause: boolean;
  allowsThinkingPause: boolean;
  maxHoldingPhraseWords: number;
  preferShortPauseOverLongExplanation: boolean;
};

// -- Clarify behavior --
export type VoiceClarifyBehaviorContract = {
  clarifyOnLowConfidence: boolean;
  clarifyOnProtectedMeaning: boolean;
  maxClarificationsPerTurn: number;
  preferSingleClarifyingQuestion: boolean;
};

// -- Interruption loop --
export type VoiceInterruptionLoopContract = {
  supportsBargeIn: boolean;
  stopCurrentTurnOnInterrupt: boolean;
  recoverSoftly: boolean;
  maxRecoverySentences: number;
  restateOnlyMinimalContext: boolean;
};

// -- Continuation behavior --
export type VoiceContinuationBehaviorContract = {
  supportsMultiTurn: boolean;
  continueOnlyIfContextFresh: boolean;
  maxSequentialTurnsWithoutUserReset: number;
  preferOneNextStepAtATime: boolean;
};

// -- Closure behavior --
export type VoiceClosureBehaviorContract = {
  supportsSoftClosure: boolean;
  avoidAbruptEndings: boolean;
  avoidOverFriendlyFarewellSpam: boolean;
  maxClosureSentences: number;
};

// -- Memory behavior --
export type VoiceMemoryBehaviorContract = {
  remembersImmediateTurnContext: boolean;
  remembersShortSessionContext: boolean;
  maxContextCarryTurns: number;
  dropStaleContextGracefully: boolean;
};

// -- Conversation loop state --
export type ConversationLoopState = {
  turnCount: number;
  consecutiveSystemTurns: number;
  lastClarificationTurn: number | null;
  contextFresh: boolean;
  interrupted: boolean;
  closurePending: boolean;
};

// -- Loop decision --
export type LoopDecision =
  | { action: "acknowledge"; phrase?: string }
  | { action: "answer"; phrase: string }
  | { action: "clarify"; phrase: string }
  | { action: "pause"; phrase?: string }
  | { action: "recover"; phrase: string }
  | { action: "continue"; phrase: string }
  | { action: "close"; phrase: string }
  | { action: "reset"; phrase: string };

// -- ValidationError --
export type VoiceLoopValidationError = {
  path: string;
  message: string;
};
