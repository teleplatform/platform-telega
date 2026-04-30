// Voice Runtime State Machine v1.0 — Unit Tests
// Run with: npx tsx tests/unit/voice-runtime/voice-runtime-state-machine.test.ts

import assert from "node:assert/strict";
import { voiceRuntimeStateMachine } from "../../../src/voice-runtime/builtin.js";
import { validateStateMachine } from "../../../src/voice-runtime/validators.js";
import {
  getVoiceRuntimeStateMachine,
  isTransitionAllowedSelector,
  getAllowedNextStatesSelector,
  supportsPauseResume,
  supportsInterruptionRecovery,
  getMaxClarificationsPerTurn,
  getMaxRecoveryTurns,
  getMachineVersion,
} from "../../../src/voice-runtime/selectors.js";
import { findTransition, isTransitionAllowed, getAllowedNextStates } from "../../../src/voice-runtime/transitions.js";
import { createVoiceSession, transitionSession } from "../../../src/voice-runtime/session.js";
import { handleInterruption, startRecovery } from "../../../src/voice-runtime/interruptions.js";
import { resumeToListening, resumeToRecovering } from "../../../src/voice-runtime/resume.js";
import { startClosure, completeSession } from "../../../src/voice-runtime/closure.js";
import {
  classifyTerminalOutcome,
  isTruthyTerminalOutcome,
  isInterruptedSession,
  wasClarified,
  assertTruthfulCompletion,
  getSessionSummary,
} from "../../../src/voice-runtime/truth.js";
import {
  checkTransitionGuard,
  checkClarifyLimit,
  checkRecoveryLimit,
  checkResumeLegality,
  checkClosureLegality,
  checkCanContinue,
  canTransitionToSpeaking,
} from "../../../src/voice-runtime/guards.js";
import { ALL_STATES, TERMINAL_STATES, isTerminalState, isActiveState, isRecoveryState, isListeningState, isSpeakingState } from "../../../src/voice-runtime/states.js";
import type { VoiceRuntimeSession, VoiceRuntimeState, VoiceRuntimeStateMachine } from "../../../src/voice-runtime/types.js";

// Auto-registered via builtin import
const MACHINE = voiceRuntimeStateMachine;

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e: any) {
    failed++;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// ── Builtin Loading ──
console.log("\nBuiltin loading:");

test("builtin machine loads", () => {
  assert.ok(MACHINE);
  assert.equal(MACHINE.version, "1.0.0");
});

test("builtin machine has transitions", () => {
  assert.ok(MACHINE.allowedTransitions.length > 0);
});

test("builtin machine has limits set", () => {
  assert.equal(MACHINE.maxClarificationsPerTurn, 1);
  assert.equal(MACHINE.maxRecoveryTurns, 2);
});

test("builtin machine has feature flags", () => {
  assert.equal(MACHINE.supportsPauseResume, true);
  assert.equal(MACHINE.supportsInterruptionRecovery, true);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin machine validates with no errors", () => {
  const errors = validateStateMachine(MACHINE);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Selectors ──
console.log("\nSelectors:");

test("getVoiceRuntimeStateMachine returns machine", () => {
  const m = getVoiceRuntimeStateMachine();
  assert.ok(m);
  assert.equal(m!.version, "1.0.0");
});

test("isTransitionAllowedSelector works", () => {
  assert.equal(isTransitionAllowedSelector("idle", "session_created"), true);
  assert.equal(isTransitionAllowedSelector("idle", "speaking"), false);
});

test("getAllowedNextStatesSelector works", () => {
  const next = getAllowedNextStatesSelector("waiting_user");
  assert.ok(next);
  assert.ok(next!.includes("listening"));
  assert.ok(next!.includes("closing"));
  assert.ok(next!.includes("paused"));
  assert.ok(next!.includes("clarifying"));
  assert.ok(next!.includes("blocked"));
  assert.ok(next!.includes("failed"));
});

test("supportsPauseResume returns true", () => {
  assert.equal(supportsPauseResume(), true);
});

test("supportsInterruptionRecovery returns true", () => {
  assert.equal(supportsInterruptionRecovery(), true);
});

test("getMaxClarificationsPerTurn returns 1", () => {
  assert.equal(getMaxClarificationsPerTurn(), 1);
});

test("getMaxRecoveryTurns returns 2", () => {
  assert.equal(getMaxRecoveryTurns(), 2);
});

test("getMachineVersion returns 1.0.0", () => {
  assert.equal(getMachineVersion(), "1.0.0");
});

// ── Transitions ──
console.log("\nTransitions:");

test("findTransition returns transition for valid pair", () => {
  const t = findTransition("idle", "session_created");
  assert.ok(t);
  assert.equal(t!.from, "idle");
  assert.equal(t!.to, "session_created");
  assert.equal(t!.reason, "session_started");
});

test("isTransitionAllowed returns true for valid pairs", () => {
  assert.equal(isTransitionAllowed("idle", "session_created"), true);
  assert.equal(isTransitionAllowed("speaking", "waiting_user"), true);
  assert.equal(isTransitionAllowed("waiting_user", "closing"), true);
  assert.equal(isTransitionAllowed("closing", "completed"), true);
});

test("isTransitionAllowed returns false for forbidden pairs", () => {
  assert.equal(isTransitionAllowed("idle", "speaking"), false);
  assert.equal(isTransitionAllowed("interrupted", "speaking"), false);
  assert.equal(isTransitionAllowed("completed", "listening"), false);
  assert.equal(isTransitionAllowed("blocked", "speaking"), false);
  assert.equal(isTransitionAllowed("failed", "speaking"), false);
  assert.equal(isTransitionAllowed("paused", "speaking"), false);
});

test("getAllowedNextStates returns correct states", () => {
  const fromUnderstanding = getAllowedNextStates("understanding");
  assert.ok(fromUnderstanding.includes("speaking"));
  assert.ok(fromUnderstanding.includes("acknowledging"));
  assert.ok(fromUnderstanding.includes("clarifying"));
  assert.ok(fromUnderstanding.includes("blocked"));
  assert.ok(fromUnderstanding.includes("failed"));
});

test("terminal states have no outgoing transitions", () => {
  for (const terminal of TERMINAL_STATES) {
    const next = getAllowedNextStates(terminal);
    assert.equal(next.length, 0, `${terminal} should have no outgoing transitions`);
  }
});

// ── Session Lifecycle ──
console.log("\nSession lifecycle:");

test("createVoiceSession creates session in session_created state", () => {
  const session = createVoiceSession();
  assert.equal(session.state, "session_created");
  assert.equal(session.surface, "voice");
  assert.equal(session.personaId, "arisha");
  assert.equal(session.turnCount, 0);
  assert.equal(session.clarificationCountInCurrentTurn, 0);
  assert.equal(session.interruptionCount, 0);
  assert.equal(session.contextFresh, true);
});

test("transition: session_created → listening", () => {
  const session = createVoiceSession();
  const result = transitionSession(session, "listening", MACHINE);
  assert.equal(result.ok, true);
  assert.equal((result as any).session.state, "listening");
});

test("full standard path: idle → ... → waiting_user", () => {
  let session = createVoiceSession({ sessionId: "test-1" });
  assert.equal(session.state, "session_created");

  session = (transitionSession(session, "listening", MACHINE) as any).session;
  assert.equal(session.state, "listening");

  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  assert.equal(session.state, "understanding");

  session = (transitionSession(session, "speaking", MACHINE) as any).session;
  assert.equal(session.state, "speaking");

  session = (transitionSession(session, "waiting_user", MACHINE) as any).session;
  assert.equal(session.state, "waiting_user");
  assert.equal(session.turnCount, 1);
});

test("acknowledge path: understanding → acknowledging → speaking", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "acknowledging", MACHINE) as any).session;
  assert.equal(session.state, "acknowledging");
  session = (transitionSession(session, "speaking", MACHINE) as any).session;
  assert.equal(session.state, "speaking");
});

test("clarify path: understanding → clarifying → waiting_user", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "clarifying", MACHINE) as any).session;
  assert.equal(session.state, "clarifying");
  session = (transitionSession(session, "waiting_user", MACHINE) as any).session;
  assert.equal(session.state, "waiting_user");
  assert.equal(session.clarificationCountInCurrentTurn, 0); // reset after turn
});

test("closure path: waiting_user → closing → completed", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "speaking", MACHINE) as any).session;
  session = (transitionSession(session, "waiting_user", MACHINE) as any).session;
  session = (transitionSession(session, "closing", MACHINE) as any).session;
  assert.equal(session.state, "closing");
  session = (transitionSession(session, "completed", MACHINE) as any).session;
  assert.equal(session.state, "completed");
});

// ── Interruption / Recovery ──
console.log("\nInterruption / recovery paths:");

test("interruption path: speaking → interrupted", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "speaking", MACHINE) as any).session;

  const result = handleInterruption(session, MACHINE);
  assert.equal(result.ok, true);
  assert.equal((result as any).session.state, "interrupted");
  assert.equal((result as any).session.interruptionCount, 1);
});

test("recovery path: interrupted → recovering → speaking", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "speaking", MACHINE) as any).session;
  session = (handleInterruption(session, MACHINE) as any).session;

  const result = startRecovery(session, MACHINE);
  assert.equal(result.ok, true);
  assert.equal((result as any).session.state, "recovering");
});

test("cannot interrupt from non-speaking states", () => {
  const session = createVoiceSession();
  const result = handleInterruption(session, MACHINE);
  assert.equal(result.ok, false);
});

test("cannot recover from non-interrupted states", () => {
  const session = createVoiceSession();
  const result = startRecovery(session, MACHINE);
  assert.equal(result.ok, false);
});

// ── Pause / Resume ──
console.log("\nPause / resume paths:");

test("pause path: waiting_user → paused", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "speaking", MACHINE) as any).session;
  session = (transitionSession(session, "waiting_user", MACHINE) as any).session;
  session = (transitionSession(session, "paused", MACHINE) as any).session;
  assert.equal(session.state, "paused");
});

test("resume path: paused → listening", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "speaking", MACHINE) as any).session;
  session = (transitionSession(session, "waiting_user", MACHINE) as any).session;
  session = (transitionSession(session, "paused", MACHINE) as any).session;
  const result = resumeToListening(session, MACHINE);
  assert.equal(result.ok, true);
  assert.equal((result as any).session.state, "listening");
});

test("cannot resume from non-paused state", () => {
  const session = createVoiceSession();
  const result = resumeToListening(session, MACHINE);
  assert.equal(result.ok, false);
});

test("cannot resume from terminal states", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "blocked", MACHINE) as any).session;
  const result = resumeToListening(session, MACHINE);
  assert.equal(result.ok, false);
});

// ── Blocked / Failed Terminal Semantics ──
console.log("\nBlocked / failed terminal semantics:");

test("blocked path: listening → blocked", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "blocked", MACHINE) as any).session;
  assert.equal(session.state, "blocked");
  assert.equal(session.contextFresh, false);
});

test("failed path: understanding → failed", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "failed", MACHINE) as any).session;
  assert.equal(session.state, "failed");
});

test("cannot transition from completed to listening", () => {
  assert.equal(isTransitionAllowed("completed", "listening"), false);
});

test("cannot transition from blocked to speaking", () => {
  assert.equal(isTransitionAllowed("blocked", "speaking"), false);
});

test("cannot transition from failed to speaking", () => {
  assert.equal(isTransitionAllowed("failed", "speaking"), false);
});

// ── Guards ──
console.log("\nGuards:");

test("checkTransitionGuard allows valid transitions", () => {
  const result = checkTransitionGuard("idle", "session_created");
  assert.equal(result.ok, true);
});

test("checkTransitionGuard blocks forbidden transitions", () => {
  const result = checkTransitionGuard("idle", "speaking");
  assert.equal(result.ok, false);
});

test("checkClarifyLimit allows under limit", () => {
  const session: VoiceRuntimeSession = {
    ...createVoiceSession(),
    clarificationCountInCurrentTurn: 0,
  };
  const result = checkClarifyLimit(session, MACHINE);
  assert.equal(result.ok, true);
});

test("checkClarifyLimit blocks at limit", () => {
  const session: VoiceRuntimeSession = {
    ...createVoiceSession(),
    clarificationCountInCurrentTurn: 1,
  };
  const result = checkClarifyLimit(session, MACHINE);
  assert.equal(result.ok, false);
});

test("checkResumeLegality allows from paused", () => {
  const session: VoiceRuntimeSession = {
    ...createVoiceSession(),
    state: "paused",
  };
  const result = checkResumeLegality(session);
  assert.equal(result.ok, true);
});

test("checkResumeLegality blocks from non-paused", () => {
  const session = createVoiceSession();
  const result = checkResumeLegality(session);
  assert.equal(result.ok, false);
});

test("checkClosureLegality allows from waiting_user", () => {
  const session: VoiceRuntimeSession = {
    ...createVoiceSession(),
    state: "waiting_user",
  };
  const result = checkClosureLegality(session);
  assert.equal(result.ok, true);
});

test("checkClosureLegality blocks from idle", () => {
  const session = createVoiceSession();
  const result = checkClosureLegality(session);
  assert.equal(result.ok, false);
});

test("checkClosureLegality blocks from terminal", () => {
  const session: VoiceRuntimeSession = {
    ...createVoiceSession(),
    state: "completed",
  };
  const result = checkClosureLegality(session);
  assert.equal(result.ok, false);
});

test("canTransitionToSpeaking allows from understanding", () => {
  const session: VoiceRuntimeSession = {
    ...createVoiceSession(),
    state: "understanding",
  };
  const result = canTransitionToSpeaking(session);
  assert.equal(result.ok, true);
});

test("canTransitionToSpeaking blocks from idle", () => {
  const session = createVoiceSession();
  const result = canTransitionToSpeaking(session);
  assert.equal(result.ok, false);
});

// ── States ──
console.log("\nStates:");

test("ALL_STATES has 15 states", () => {
  assert.equal(ALL_STATES.length, 15);
});

test("TERMINAL_STATES has 3 states", () => {
  assert.equal(TERMINAL_STATES.length, 3);
  assert.ok(TERMINAL_STATES.includes("completed"));
  assert.ok(TERMINAL_STATES.includes("blocked"));
  assert.ok(TERMINAL_STATES.includes("failed"));
});

test("isTerminalState returns true for terminal states", () => {
  assert.equal(isTerminalState("completed"), true);
  assert.equal(isTerminalState("blocked"), true);
  assert.equal(isTerminalState("failed"), true);
});

test("isTerminalState returns false for non-terminal states", () => {
  assert.equal(isTerminalState("idle"), false);
  assert.equal(isTerminalState("speaking"), false);
  assert.equal(isTerminalState("waiting_user"), false);
});

test("isActiveState returns true for non-idle non-terminal", () => {
  assert.equal(isActiveState("listening"), true);
  assert.equal(isActiveState("speaking"), true);
  assert.equal(isActiveState("paused"), true);
});

test("isRecoveryState returns true for recovery states", () => {
  assert.equal(isRecoveryState("interrupted"), true);
  assert.equal(isRecoveryState("recovering"), true);
});

test("isListeningState returns true for listening states", () => {
  assert.equal(isListeningState("listening"), true);
  assert.equal(isListeningState("waiting_user"), true);
});

test("isSpeakingState returns true for speaking states", () => {
  assert.equal(isSpeakingState("speaking"), true);
  assert.equal(isSpeakingState("acknowledging"), true);
  assert.equal(isSpeakingState("clarifying"), true);
});

// ── Truth ──
console.log("\nTruth:");

test("classifyTerminalOutcome returns correct outcomes", () => {
  assert.equal(classifyTerminalOutcome("completed"), "completed");
  assert.equal(classifyTerminalOutcome("blocked"), "blocked");
  assert.equal(classifyTerminalOutcome("failed"), "failed");
  assert.equal(classifyTerminalOutcome("speaking"), null);
});

test("isTruthyTerminalOutcome returns true only for completed", () => {
  assert.equal(isTruthyTerminalOutcome("completed"), true);
  assert.equal(isTruthyTerminalOutcome("blocked"), false);
  assert.equal(isTruthyTerminalOutcome("failed"), false);
});

test("isInterruptedSession returns true when interruption count > 0", () => {
  const session: VoiceRuntimeSession = {
    ...createVoiceSession(),
    interruptionCount: 1,
  };
  assert.equal(isInterruptedSession(session), true);
});

test("wasClarified returns true when clarification count > 0", () => {
  const session: VoiceRuntimeSession = {
    ...createVoiceSession(),
    clarificationCountInCurrentTurn: 1,
  };
  assert.equal(wasClarified(session), true);
});

test("getSessionSummary returns complete summary", () => {
  const session = createVoiceSession({ sessionId: "test-summary" });
  const summary = getSessionSummary(session);
  assert.equal(summary.sessionId, "test-summary");
  assert.equal(summary.state, "session_created");
  assert.equal(summary.isTerminal, false);
  assert.equal(summary.turnCount, 0);
});

test("assertTruthfulCompletion returns null for valid completed session", () => {
  let session = createVoiceSession();
  session = (transitionSession(session, "listening", MACHINE) as any).session;
  session = (transitionSession(session, "understanding", MACHINE) as any).session;
  session = (transitionSession(session, "speaking", MACHINE) as any).session;
  session = (transitionSession(session, "waiting_user", MACHINE) as any).session;
  session = (transitionSession(session, "closing", MACHINE) as any).session;
  session = (transitionSession(session, "completed", MACHINE) as any).session;

  const result = assertTruthfulCompletion(session);
  assert.equal(result, null);
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no idle → speaking", () => {
  assert.equal(isTransitionAllowed("idle", "speaking"), false);
});

test("no interrupted → completed", () => {
  assert.equal(isTransitionAllowed("interrupted", "completed"), false);
});

test("no completed → listening without new session", () => {
  assert.equal(isTransitionAllowed("completed", "listening"), false);
});

test("no session_created → completed", () => {
  assert.equal(isTransitionAllowed("session_created", "completed"), false);
});

test("no clarifying → completed", () => {
  assert.equal(isTransitionAllowed("clarifying", "completed"), false);
});

test("no blocked → speaking", () => {
  assert.equal(isTransitionAllowed("blocked", "speaking"), false);
});

test("no failed → speaking", () => {
  assert.equal(isTransitionAllowed("failed", "speaking"), false);
});

test("no paused → speaking", () => {
  assert.equal(isTransitionAllowed("paused", "speaking"), false);
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
