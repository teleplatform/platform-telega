// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Builtin Machine
//
// Production-grade lifecycle state machine for voice runtime.
// States, allowed transitions, limits, and feature flags.
// ─────────────────────────────────────────────────────────────

import type { VoiceRuntimeStateMachine } from "./types.js";
import { ALLOWED_TRANSITIONS } from "./transitions.js";
import { setVoiceRuntimeStateMachine } from "./selectors.js";

export const voiceRuntimeStateMachine: VoiceRuntimeStateMachine = {
  version: "1.0.0",
  allowedTransitions: ALLOWED_TRANSITIONS,
  maxClarificationsPerTurn: 1,
  maxRecoveryTurns: 2,
  supportsPauseResume: true,
  supportsInterruptionRecovery: true,
};

// Auto-register
setVoiceRuntimeStateMachine(voiceRuntimeStateMachine);
