// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Core Types
//
// Status: IMPLEMENTATION_SPEC
// Depends on: Voice Interaction Loop Contract v1.0 + all prior layers
//
// CORE DECISION: Voice runtime = governed state machine, not free-flowing behavior soup.
// Every voice turn must live inside a state machine, not arbitrarily jump between states.
// ─────────────────────────────────────────────────────────────

// -- Primary state enum --
export type VoiceRuntimeState =
  | "idle"
  | "session_created"
  | "listening"
  | "understanding"
  | "acknowledging"
  | "clarifying"
  | "speaking"
  | "waiting_user"
  | "interrupted"
  | "recovering"
  | "paused"
  | "closing"
  | "completed"
  | "blocked"
  | "failed";

// -- Session contract --
export type VoiceRuntimeSession = {
  sessionId: string;
  surface: "voice";
  state: VoiceRuntimeState;

  languageCode?: "ru" | "en" | "uz";
  personaId: "arisha";

  turnCount: number;
  clarificationCountInCurrentTurn: number;
  interruptionCount: number;

  lastStateAt: string;
  createdAt: string;
  updatedAt: string;

  contextFresh: boolean;
  closurePending: boolean;

  lastUserTurnAt?: string;
  lastSystemTurnAt?: string;

  notes?: string[];
};

// -- Transition contract --
export type VoiceRuntimeTransition = {
  from: VoiceRuntimeState;
  to: VoiceRuntimeState;
  reason: VoiceRuntimeTransitionReason;
};

export type VoiceRuntimeTransitionReason =
  | "session_started"
  | "input_detected"
  | "understanding_started"
  | "ack_required"
  | "clarification_required"
  | "speak_started"
  | "turn_finished"
  | "interrupt_detected"
  | "recovery_started"
  | "pause_requested"
  | "resume_requested"
  | "closure_started"
  | "session_completed"
  | "policy_blocked"
  | "runtime_failed";

// -- State machine contract --
export type VoiceRuntimeStateMachine = {
  version: string;
  allowedTransitions: VoiceRuntimeTransition[];
  maxClarificationsPerTurn: number;
  maxRecoveryTurns: number;
  supportsPauseResume: boolean;
  supportsInterruptionRecovery: boolean;
};

// -- ValidationError --
export type VoiceRuntimeValidationError = {
  path: string;
  message: string;
};

// -- Transition result --
export type TransitionResult =
  | { ok: true; session: VoiceRuntimeSession; transition: VoiceRuntimeTransition }
  | { ok: false; reason: string; from: VoiceRuntimeState; attemptedTo: VoiceRuntimeState };
