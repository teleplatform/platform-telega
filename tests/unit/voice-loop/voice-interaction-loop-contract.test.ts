// Voice Interaction Loop Contract v1.0 — Unit Tests
// Run with: npx tsx tests/unit/voice-loop/voice-interaction-loop-contract.test.ts

import assert from "node:assert/strict";
import { voiceLoopContract } from "../../../src/voice-loop/builtin.js";
import { validateLoopContract } from "../../../src/voice-loop/validators.js";
import {
  getVoiceLoopContract,
  supportsBargeIn as selectorSupportsBargeIn,
  getMaxRecoverySentences as selectorGetMaxRecoverySentences,
  getMaxContextCarryTurns as selectorGetMaxContextCarryTurns,
  shouldAcknowledgeBeforeThinking as selectorShouldAck,
  getMaxClarificationsPerTurn as selectorGetMaxClarifications,
  getMaxAcknowledgeWords as selectorGetMaxAckWords,
  getMaxHoldingPhraseWords as selectorGetMaxHoldingWords,
  getMaxClosureSentences as selectorGetMaxClosureSentences,
  supportsMultiTurn as selectorSupportsMultiTurn,
  getMaxSequentialTurns as selectorGetMaxSequentialTurns,
  getMaxEntrySentences,
} from "../../../src/voice-loop/selectors.js";
import { countWords, countSentences, getTimingProfile } from "../../../src/voice-loop/timing.js";
import {
  shouldAcknowledgeBeforeThinking as ackShouldAck,
  supportsLiveHoldingPhrase,
  avoidsMechanicalAcknowledgements,
  getMaxAcknowledgeWords,
  pickAcknowledgePhrase,
  validateAcknowledgePhrase,
} from "../../../src/voice-loop/acknowledge.js";
import {
  allowsMicroPause,
  allowsThinkingPause,
  prefersShortPauseOverLongExplanation,
  getMaxHoldingPhraseWords,
  pickHoldingPhrase,
} from "../../../src/voice-loop/pauses.js";
import {
  clarifyOnLowConfidence,
  clarifyOnProtectedMeaning,
  getMaxClarificationsPerTurn,
  preferSingleClarifyingQuestion,
  shouldClarify,
  canClarifyAgain,
  pickClarifyingPhrase,
} from "../../../src/voice-loop/clarify.js";
import {
  supportsBargeIn,
  stopCurrentTurnOnInterrupt,
  recoverSoftly,
  getMaxRecoverySentences,
  restateOnlyMinimalContext,
  pickRecoveryPhrase,
  validateRecoveryPhrase,
} from "../../../src/voice-loop/interruptions.js";
import {
  supportsMultiTurn,
  continueOnlyIfContextFresh,
  getMaxSequentialTurnsWithoutUserReset,
  preferOneNextStepAtATime,
  canContinue,
} from "../../../src/voice-loop/continuation.js";
import {
  supportsSoftClosure,
  avoidsAbruptEndings,
  avoidsOverFriendlyFarewellSpam,
  getMaxClosureSentences,
  pickClosurePhrase,
  validateClosurePhrase,
} from "../../../src/voice-loop/closure.js";
import {
  remembersImmediateTurnContext,
  remembersShortSessionContext,
  getMaxContextCarryTurns,
  dropsStaleContextGracefully,
  shouldDropContext,
  createContextRefreshPhrase,
} from "../../../src/voice-loop/memory.js";
import type { ConversationLoopState } from "../../../src/voice-loop/types.js";

// Auto-registered via builtin import
const CONTRACT = voiceLoopContract;

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

test("builtin contract loads", () => {
  assert.ok(CONTRACT);
  assert.equal(CONTRACT.surface, "voice");
  assert.ok(CONTRACT.version);
});

test("all sub-contracts present", () => {
  assert.ok(CONTRACT.entryBehavior);
  assert.ok(CONTRACT.acknowledgeBehavior);
  assert.ok(CONTRACT.pauseBehavior);
  assert.ok(CONTRACT.clarifyBehavior);
  assert.ok(CONTRACT.interruptionBehavior);
  assert.ok(CONTRACT.continuationBehavior);
  assert.ok(CONTRACT.closureBehavior);
  assert.ok(CONTRACT.memoryBehavior);
});

test("contract has notes", () => {
  assert.ok(CONTRACT.notes && CONTRACT.notes.length > 0);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin contract validates with no errors", () => {
  const errors = validateLoopContract(CONTRACT);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Required Limits ──
console.log("\nRequired limits:");

test("maxEntrySentences <= 2", () => {
  assert.ok(CONTRACT.entryBehavior.maxEntrySentences <= 2);
});

test("maxAcknowledgeWords <= 4", () => {
  assert.ok(CONTRACT.acknowledgeBehavior.maxAcknowledgeWords <= 4);
});

test("maxHoldingPhraseWords <= 4", () => {
  assert.ok(CONTRACT.pauseBehavior.maxHoldingPhraseWords <= 4);
});

test("maxClarificationsPerTurn <= 1", () => {
  assert.ok(CONTRACT.clarifyBehavior.maxClarificationsPerTurn <= 1);
});

test("maxRecoverySentences <= 2", () => {
  assert.ok(CONTRACT.interruptionBehavior.maxRecoverySentences <= 2);
});

test("maxClosureSentences <= 2", () => {
  assert.ok(CONTRACT.closureBehavior.maxClosureSentences <= 2);
});

test("supportsBargeIn === true", () => {
  assert.equal(CONTRACT.interruptionBehavior.supportsBargeIn, true);
});

// ── Selectors ──
console.log("\nSelectors:");

test("getVoiceLoopContract returns contract", () => {
  const c = getVoiceLoopContract();
  assert.ok(c);
  assert.equal(c!.surface, "voice");
});

test("getMaxClarificationsPerTurn returns 1", () => {
  assert.equal(selectorGetMaxClarifications(), 1);
});

test("supportsBargeIn returns true", () => {
  assert.equal(selectorSupportsBargeIn(), true);
});

test("getMaxRecoverySentences returns 2", () => {
  assert.equal(selectorGetMaxRecoverySentences(), 2);
});

test("getMaxContextCarryTurns returns 5", () => {
  assert.equal(selectorGetMaxContextCarryTurns(), 5);
});

test("shouldAcknowledgeBeforeThinking returns true", () => {
  assert.equal(selectorShouldAck(), true);
});

test("getMaxEntrySentences returns 2", () => {
  assert.equal(getMaxEntrySentences(), 2);
});

test("getMaxAcknowledgeWords returns 4", () => {
  assert.equal(selectorGetMaxAckWords(), 4);
});

test("getMaxHoldingPhraseWords returns 4", () => {
  assert.equal(selectorGetMaxHoldingWords(), 4);
});

test("getMaxClosureSentences returns 2", () => {
  assert.equal(selectorGetMaxClosureSentences(), 2);
});

test("supportsMultiTurn returns true", () => {
  assert.equal(selectorSupportsMultiTurn(), true);
});

test("getMaxSequentialTurns returns 3", () => {
  assert.equal(selectorGetMaxSequentialTurns(), 3);
});

// ── Acknowledge Behavior ──
console.log("\nAcknowledge behavior:");

test("acknowledgeBeforeLongerThinking === true", () => {
  assert.equal(ackShouldAck(CONTRACT), true);
});

test("supportsLiveHoldingPhrase === true", () => {
  assert.equal(supportsLiveHoldingPhrase(CONTRACT), true);
});

test("avoidsMechanicalAcknowledgements === true", () => {
  assert.equal(avoidsMechanicalAcknowledgements(CONTRACT), true);
});

test("picks acknowledge phrase", () => {
  const phrase = pickAcknowledgePhrase("en", 4);
  assert.ok(phrase && phrase.length > 0);
});

test("validateAcknowledgePhrase accepts short phrase", () => {
  assert.equal(validateAcknowledgePhrase("Got it.", 4), true);
});

test("validateAcknowledgePhrase rejects long phrase", () => {
  assert.equal(validateAcknowledgePhrase("I am currently processing your request and will have an answer shortly.", 4), false);
});

test("acknowledge phrases exist for all languages", () => {
  for (const lang of ["ru", "en", "uz"] as const) {
    const phrase = pickAcknowledgePhrase(lang, 4);
    assert.ok(phrase && phrase.length > 0);
  }
});

// ── Pause Behavior ──
console.log("\nPause behavior:");

test("allowsMicroPause === true", () => {
  assert.equal(allowsMicroPause(CONTRACT), true);
});

test("allowsThinkingPause === true", () => {
  assert.equal(allowsThinkingPause(CONTRACT), true);
});

test("prefersShortPauseOverLongExplanation === true", () => {
  assert.equal(prefersShortPauseOverLongExplanation(CONTRACT), true);
});

test("picks holding phrase", () => {
  const phrase = pickHoldingPhrase("en", 4);
  assert.ok(phrase && phrase.length > 0);
});

test("holding phrases exist for all languages", () => {
  for (const lang of ["ru", "en", "uz"] as const) {
    const phrase = pickHoldingPhrase(lang, 4);
    assert.ok(phrase && phrase.length > 0);
  }
});

// ── Clarify Behavior ──
console.log("\nClarify behavior:");

test("clarifyOnLowConfidence === true", () => {
  assert.equal(clarifyOnLowConfidence(CONTRACT), true);
});

test("clarifyOnProtectedMeaning === true", () => {
  assert.equal(clarifyOnProtectedMeaning(CONTRACT), true);
});

test("maxClarificationsPerTurn === 1", () => {
  assert.equal(getMaxClarificationsPerTurn(CONTRACT), 1);
});

test("preferSingleClarifyingQuestion === true", () => {
  assert.equal(preferSingleClarifyingQuestion(CONTRACT), true);
});

test("shouldClarify on low confidence", () => {
  const state: ConversationLoopState = {
    turnCount: 1,
    consecutiveSystemTurns: 1,
    lastClarificationTurn: null,
    contextFresh: true,
    interrupted: false,
    closurePending: false,
  };
  assert.equal(shouldClarify(CONTRACT, state, 0.3, false), true);
});

test("shouldClarify on protected meaning", () => {
  const state: ConversationLoopState = {
    turnCount: 1,
    consecutiveSystemTurns: 1,
    lastClarificationTurn: null,
    contextFresh: true,
    interrupted: false,
    closurePending: false,
  };
  assert.equal(shouldClarify(CONTRACT, state, 0.8, true), true);
});

test("shouldClarify returns false when already clarified", () => {
  const state: ConversationLoopState = {
    turnCount: 1,
    consecutiveSystemTurns: 1,
    lastClarificationTurn: 1,
    contextFresh: true,
    interrupted: false,
    closurePending: false,
  };
  assert.equal(shouldClarify(CONTRACT, state, 0.3, false), false);
});

test("canClarifyAgain returns true when under limit", () => {
  const state: ConversationLoopState = {
    turnCount: 2,
    consecutiveSystemTurns: 1,
    lastClarificationTurn: 1,
    contextFresh: true,
    interrupted: false,
    closurePending: false,
  };
  assert.equal(canClarifyAgain(CONTRACT, state), true);
});

test("picks clarifying phrase", () => {
  for (const lang of ["ru", "en", "uz"] as const) {
    const phrase = pickClarifyingPhrase(lang);
    assert.ok(phrase && phrase.length > 0);
  }
});

// ── Interruption Recovery ──
console.log("\nInterruption recovery:");

test("supportsBargeIn === true", () => {
  assert.equal(supportsBargeIn(CONTRACT), true);
});

test("stopCurrentTurnOnInterrupt === true", () => {
  assert.equal(stopCurrentTurnOnInterrupt(CONTRACT), true);
});

test("recoverSoftly === true", () => {
  assert.equal(recoverSoftly(CONTRACT), true);
});

test("maxRecoverySentences === 2", () => {
  assert.equal(getMaxRecoverySentences(CONTRACT), 2);
});

test("restateOnlyMinimalContext === true", () => {
  assert.equal(restateOnlyMinimalContext(CONTRACT), true);
});

test("picks recovery phrase", () => {
  for (const lang of ["ru", "en", "uz"] as const) {
    const phrase = pickRecoveryPhrase(lang);
    assert.ok(phrase && phrase.length > 0);
  }
});

test("validates recovery phrase length", () => {
  assert.equal(validateRecoveryPhrase("Where were we?", 2), true);
  assert.equal(validateRecoveryPhrase("Let me start over. First, you asked about X. Then I said Y. And now we're here.", 2), false);
});

// ── Continuation Behavior ──
console.log("\nContinuation behavior:");

test("supportsMultiTurn === true", () => {
  assert.equal(supportsMultiTurn(CONTRACT), true);
});

test("continueOnlyIfContextFresh === true", () => {
  assert.equal(continueOnlyIfContextFresh(CONTRACT), true);
});

test("maxSequentialTurnsWithoutUserReset === 3", () => {
  assert.equal(getMaxSequentialTurnsWithoutUserReset(CONTRACT), 3);
});

test("preferOneNextStepAtATime === true", () => {
  assert.equal(preferOneNextStepAtATime(CONTRACT), true);
});

test("canContinue when context fresh and under limit", () => {
  const state: ConversationLoopState = {
    turnCount: 2,
    consecutiveSystemTurns: 1,
    lastClarificationTurn: null,
    contextFresh: true,
    interrupted: false,
    closurePending: false,
  };
  assert.equal(canContinue(CONTRACT, state), true);
});

test("canContinue returns false when context stale", () => {
  const state: ConversationLoopState = {
    turnCount: 2,
    consecutiveSystemTurns: 1,
    lastClarificationTurn: null,
    contextFresh: false,
    interrupted: false,
    closurePending: false,
  };
  assert.equal(canContinue(CONTRACT, state), false);
});

test("canContinue returns false when over turn limit", () => {
  const state: ConversationLoopState = {
    turnCount: 5,
    consecutiveSystemTurns: 3,
    lastClarificationTurn: null,
    contextFresh: true,
    interrupted: false,
    closurePending: false,
  };
  assert.equal(canContinue(CONTRACT, state), false);
});

// ── Closure Behavior ──
console.log("\nClosure behavior:");

test("supportsSoftClosure === true", () => {
  assert.equal(supportsSoftClosure(CONTRACT), true);
});

test("avoidsAbruptEndings === true", () => {
  assert.equal(avoidsAbruptEndings(CONTRACT), true);
});

test("avoidsOverFriendlyFarewellSpam === true", () => {
  assert.equal(avoidsOverFriendlyFarewellSpam(CONTRACT), true);
});

test("maxClosureSentences === 2", () => {
  assert.equal(getMaxClosureSentences(CONTRACT), 2);
});

test("picks closure phrase", () => {
  for (const lang of ["ru", "en", "uz"] as const) {
    const phrase = pickClosurePhrase(lang);
    assert.ok(phrase && phrase.length > 0);
  }
});

test("validates closure phrase length", () => {
  assert.equal(validateClosurePhrase("I'm here if you need me.", 2), true);
  assert.equal(validateClosurePhrase("Thank you for using our service. Have a great day. Don't hesitate to reach out again. Goodbye!", 2), false);
});

// ── Memory Behavior ──
console.log("\nMemory behavior:");

test("remembersImmediateTurnContext === true", () => {
  assert.equal(remembersImmediateTurnContext(CONTRACT), true);
});

test("remembersShortSessionContext === true", () => {
  assert.equal(remembersShortSessionContext(CONTRACT), true);
});

test("maxContextCarryTurns === 5", () => {
  assert.equal(getMaxContextCarryTurns(CONTRACT), 5);
});

test("dropsStaleContextGracefully === true", () => {
  assert.equal(dropsStaleContextGracefully(CONTRACT), true);
});

test("shouldDropContext returns false when under limit", () => {
  const state: ConversationLoopState = {
    turnCount: 3,
    consecutiveSystemTurns: 1,
    lastClarificationTurn: null,
    contextFresh: true,
    interrupted: false,
    closurePending: false,
  };
  assert.equal(shouldDropContext(CONTRACT, state), false);
});

test("shouldDropContext returns true when over limit", () => {
  const state: ConversationLoopState = {
    turnCount: 6,
    consecutiveSystemTurns: 1,
    lastClarificationTurn: null,
    contextFresh: true,
    interrupted: false,
    closurePending: false,
  };
  assert.equal(shouldDropContext(CONTRACT, state), true);
});

test("creates context refresh phrase", () => {
  for (const lang of ["ru", "en", "uz"] as const) {
    const phrase = createContextRefreshPhrase(lang);
    assert.ok(phrase && phrase.length > 0);
  }
});

// ── Timing ──
console.log("\nTiming:");

test("countWords returns correct count", () => {
  assert.equal(countWords("One two three"), 3);
  assert.equal(countWords("Single"), 1);
});

test("countSentences returns correct count", () => {
  assert.equal(countSentences("One. Two! Three?"), 3);
  assert.equal(countSentences("Just one"), 1);
});

test("getTimingProfile returns complete profile", () => {
  const profile = getTimingProfile(CONTRACT);
  assert.equal(profile.entry.maxSentences, 2);
  assert.equal(profile.acknowledge.maxWords, 4);
  assert.equal(profile.pause.maxWords, 4);
  assert.equal(profile.clarify.maxPerTurn, 1);
  assert.equal(profile.continuation.maxSequentialTurns, 3);
  assert.equal(profile.closure.maxSentences, 2);
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no multi-question voice clarify (maxClarificationsPerTurn <= 1)", () => {
  assert.ok(CONTRACT.clarifyBehavior.maxClarificationsPerTurn <= 1);
});

test("no long recovery (maxRecoverySentences <= 2)", () => {
  assert.ok(CONTRACT.interruptionBehavior.maxRecoverySentences <= 2);
});

test("no long closure (maxClosureSentences <= 2)", () => {
  assert.ok(CONTRACT.closureBehavior.maxClosureSentences <= 2);
});

test("acknowledge stays short (maxAcknowledgeWords <= 4)", () => {
  assert.ok(CONTRACT.acknowledgeBehavior.maxAcknowledgeWords <= 4);
});

test("loop never implies fake completion (entry is short)", () => {
  assert.ok(CONTRACT.entryBehavior.entryShouldBeShort);
  assert.ok(CONTRACT.entryBehavior.avoidSystemicGreetingSpam);
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
