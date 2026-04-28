// ─────────────────────────────────────────────────────────────
// VOICE RUNTIME STATE MACHINE v1.0 — Validators
//
// Checks:
// - all critical states exist
// - required lifecycle paths exist
// - forbidden paths absent
// - maxClarificationsPerTurn <= 1
// - maxRecoveryTurns <= 2
// - supportsPauseResume === true
// - supportsInterruptionRecovery === true
// - completed/blocked/failed have no illegal outgoing transitions
// ─────────────────────────────────────────────────────────────

import type {
  VoiceRuntimeStateMachine,
  VoiceRuntimeState,
  VoiceRuntimeValidationError,
  VoiceRuntimeTransition,
} from "./types.js";
import { ALL_STATES, TERMINAL_STATES, isTerminalState } from "./states.js";

export function validateStateMachine(machine: VoiceRuntimeStateMachine): VoiceRuntimeValidationError[] {
  const errors: VoiceRuntimeValidationError[] = [];

  // Version
  if (!machine.version || machine.version.trim() === "") {
    errors.push({ path: "version", message: "Version is required" });
  }

  // Limits
  if (machine.maxClarificationsPerTurn > 1) {
    errors.push({ path: "maxClarificationsPerTurn", message: "Must be <= 1" });
  }
  if (machine.maxRecoveryTurns > 2) {
    errors.push({ path: "maxRecoveryTurns", message: "Must be <= 2" });
  }

  // Feature flags
  if (machine.supportsPauseResume !== true) {
    errors.push({ path: "supportsPauseResume", message: "Must be true" });
  }
  if (machine.supportsInterruptionRecovery !== true) {
    errors.push({ path: "supportsInterruptionRecovery", message: "Must be true" });
  }

  // Check all states have outgoing transitions (except terminal states)
  const statesWithOutgoing = new Set(machine.allowedTransitions.map((t) => t.from));
  for (const state of ALL_STATES) {
    if (!isTerminalState(state) && state !== "idle" && !statesWithOutgoing.has(state)) {
      errors.push({ path: `states.${state}`, message: `No outgoing transitions defined for: ${state}` });
    }
  }

  // Check forbidden paths are absent
  const forbiddenPaths: [VoiceRuntimeState, VoiceRuntimeState][] = [
    ["idle", "speaking"],
    ["session_created", "completed"],
    ["clarifying", "completed"],
    ["interrupted", "speaking"],
    ["completed", "listening"],
    ["blocked", "speaking"],
    ["failed", "speaking"],
    ["paused", "speaking"],
  ];

  for (const [from, to] of forbiddenPaths) {
    const found = machine.allowedTransitions.some((t) => t.from === from && t.to === to);
    if (found) {
      errors.push({ path: `transitions.${from}→${to}`, message: `Forbidden transition: ${from} → ${to}` });
    }
  }

  // Check terminal states have no illegal outgoing transitions
  for (const terminal of TERMINAL_STATES) {
    const outgoingFromTerminal = machine.allowedTransitions.filter((t) => t.from === terminal);
    if (outgoingFromTerminal.length > 0) {
      // Terminal states can only transition to themselves (no outgoing at all is fine)
      for (const t of outgoingFromTerminal) {
        if (t.to !== terminal) {
          errors.push({
            path: `transitions.${terminal}→${t.to}`,
            message: `Terminal state ${terminal} must not have outgoing transitions to ${t.to}`,
          });
        }
      }
    }
  }

  // Required paths must exist
  const requiredPaths: [VoiceRuntimeState, VoiceRuntimeState][] = [
    ["idle", "session_created"],
    ["session_created", "listening"],
    ["listening", "understanding"],
    ["understanding", "speaking"],
    ["speaking", "waiting_user"],
    ["waiting_user", "closing"],
    ["closing", "completed"],
    ["understanding", "clarifying"],
    ["clarifying", "waiting_user"],
    ["speaking", "interrupted"],
    ["interrupted", "recovering"],
    ["recovering", "speaking"],
    ["recovering", "waiting_user"],
    ["waiting_user", "paused"],
    ["paused", "listening"],
  ];

  for (const [from, to] of requiredPaths) {
    const found = machine.allowedTransitions.some((t) => t.from === from && t.to === to);
    if (!found) {
      errors.push({ path: `required_paths.${from}→${to}`, message: `Required path missing: ${from} → ${to}` });
    }
  }

  return errors;
}

export function validateTransition(transition: VoiceRuntimeTransition): VoiceRuntimeValidationError[] {
  const errors: VoiceRuntimeValidationError[] = [];

  if (!transition.from) {
    errors.push({ path: "transition.from", message: "from state is required" });
  }
  if (!transition.to) {
    errors.push({ path: "transition.to", message: "to state is required" });
  }
  if (!transition.reason) {
    errors.push({ path: "transition.reason", message: "reason is required" });
  }

  return errors;
}
