// Voice Surface Response Contract v1.0 — Unit Tests
// Run with: npx tsx tests/unit/voice-surface/voice-surface-response-contract.test.ts

import assert from "node:assert/strict";
import {
  webContract,
  tgmContract,
  telegramContract,
  voiceContract,
  ALL_SURFACE_CONTRACTS,
} from "../../../src/voice-surface/builtin.js";
import { validateContract, validateAllContracts } from "../../../src/voice-surface/validators.js";
import {
  registerSurface,
  getSurfaceContract,
  hasSurface,
  listSurfaces,
  getMaxSentences,
  getDefaultLength,
  shouldClarifyFirst,
  supportsHoldingPhrase,
  supportsInterruption,
  isVoiceStricterThan,
  compareStrictness,
} from "../../../src/voice-surface/selectors.js";
import {
  shouldClarifyBeforeAction,
  shouldClarifyBeforeProtectedMeaning,
  prefersImmediateAnswer,
  allowsFollowupPrompt,
  getFollowupPromptMaxCount,
  validateTurnBehavior,
} from "../../../src/voice-surface/turns.js";
import {
  HOLDING_PHRASES,
  supportsHoldingPhrase as latencySupportsHolding,
  allowsProgressiveResponse,
  prefersFastAcknowledgeThenAnswer,
  getHoldingPhraseMaxWords,
  pickHoldingPhrase,
  validateHoldingPhrase,
} from "../../../src/voice-surface/latency.js";
import {
  forbidFakeCompletion,
  forbidPreparedAsExecuted,
  forbidHandoffAsDelivered,
  requireTruthfulStatusLanguage,
  preferExplicitBlockedExplanation,
  checkTruthfulWording,
} from "../../../src/voice-surface/truth.js";
import {
  supportsInterruption as intSupports,
  restartSoftlyAfterInterruption,
  restateContextBriefly,
  getMaxRecoverySentences,
  pickRecoveryPhrase,
  validateRecoveryPhrase,
} from "../../../src/voice-surface/interruptions.js";
import {
  shapeResponse,
  countSentences,
  exceedsMaxSentences,
  countPrimaryIdeas,
  exceedsMaxPrimaryIdeas,
  isWithinLimits,
} from "../../../src/voice-surface/shaping.js";

// Register all builtin surfaces
for (const contract of ALL_SURFACE_CONTRACTS) {
  registerSurface(contract);
}

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

test("web contract loads", () => {
  assert.equal(webContract.surface, "web");
  assert.equal(webContract.responseShape.defaultLength, "medium");
});

test("tgm contract loads", () => {
  assert.equal(tgmContract.surface, "tgm");
  assert.equal(tgmContract.responseShape.defaultLength, "short");
});

test("telegram contract loads", () => {
  assert.equal(telegramContract.surface, "telegram");
  assert.equal(telegramContract.responseShape.defaultLength, "short");
});

test("voice contract loads", () => {
  assert.equal(voiceContract.surface, "voice");
  assert.equal(voiceContract.responseShape.defaultLength, "short");
});

test("all 4 contracts present in ALL_SURFACE_CONTRACTS", () => {
  assert.equal(ALL_SURFACE_CONTRACTS.length, 4);
});

// ── Validation ──
console.log("\nValidation:");

test("web contract validates", () => {
  const errors = validateContract(webContract);
  assert.equal(errors.length, 0, `Web errors: ${JSON.stringify(errors)}`);
});

test("tgm contract validates", () => {
  const errors = validateContract(tgmContract);
  assert.equal(errors.length, 0, `TGM errors: ${JSON.stringify(errors)}`);
});

test("telegram contract validates", () => {
  const errors = validateContract(telegramContract);
  assert.equal(errors.length, 0, `Telegram errors: ${JSON.stringify(errors)}`);
});

test("voice contract validates", () => {
  const errors = validateContract(voiceContract);
  assert.equal(errors.length, 0, `Voice errors: ${JSON.stringify(errors)}`);
});

test("validateAllContracts returns no errors", () => {
  const results = validateAllContracts(ALL_SURFACE_CONTRACTS);
  for (const [surface, errors] of results) {
    assert.equal(errors.length, 0, `${surface} errors: ${JSON.stringify(errors)}`);
  }
});

// ── Selector Behavior ──
console.log("\nSelector behavior:");

test("getSurfaceContract returns web", () => {
  const c = getSurfaceContract("web");
  assert.ok(c);
  assert.equal(c!.surface, "web");
});

test("getSurfaceContract returns voice", () => {
  const c = getSurfaceContract("voice");
  assert.ok(c);
  assert.equal(c!.surface, "voice");
});

test("hasSurface returns true for all surfaces", () => {
  assert.equal(hasSurface("web"), true);
  assert.equal(hasSurface("tgm"), true);
  assert.equal(hasSurface("telegram"), true);
  assert.equal(hasSurface("voice"), true);
});

test("listSurfaces returns 4", () => {
  assert.equal(listSurfaces().length, 4);
});

test("getMaxSentences returns correct values", () => {
  assert.equal(getMaxSentences("web"), 5);
  assert.equal(getMaxSentences("tgm"), 4);
  assert.equal(getMaxSentences("telegram"), 3);
  assert.equal(getMaxSentences("voice"), 2);
});

test("getDefaultLength returns correct values", () => {
  assert.equal(getDefaultLength("web"), "medium");
  assert.equal(getDefaultLength("tgm"), "short");
  assert.equal(getDefaultLength("telegram"), "short");
  assert.equal(getDefaultLength("voice"), "short");
});

test("shouldClarifyFirst returns true for all surfaces", () => {
  assert.equal(shouldClarifyFirst("web"), true);
  assert.equal(shouldClarifyFirst("voice"), true);
});

test("supportsHoldingPhrase returns true for all surfaces", () => {
  assert.equal(supportsHoldingPhrase("web"), true);
  assert.equal(supportsHoldingPhrase("voice"), true);
});

test("supportsInterruption returns true for voice", () => {
  assert.equal(supportsInterruption("voice"), true);
});

test("isVoiceStricterThan works correctly", () => {
  assert.equal(isVoiceStricterThan("voice", "web"), true);
  assert.equal(isVoiceStricterThan("voice", "telegram"), true);
  assert.equal(isVoiceStricterThan("web", "voice"), false);
});

test("compareStrictness returns voice as strictest", () => {
  const surfaces: Array<"web" | "tgm" | "telegram" | "voice"> = ["web", "tgm", "telegram", "voice"];
  surfaces.sort(compareStrictness);
  assert.equal(surfaces[0], "voice");
});

// ── Voice Stricter Than Text ──
console.log("\nVoice stricter than text:");

test("voice maxSentences <= 2", () => {
  assert.ok(voiceContract.responseShape.maxSentences <= 2);
});

test("voice maxPrimaryIdeas <= 1", () => {
  assert.ok(voiceContract.responseShape.maxPrimaryIdeas <= 1);
});

test("telegram defaultLength === short", () => {
  assert.equal(telegramContract.responseShape.defaultLength, "short");
});

test("telegram shorter than web", () => {
  assert.ok(telegramContract.responseShape.maxSentences < webContract.responseShape.maxSentences);
});

test("tgm shorter than web", () => {
  assert.ok(tgmContract.responseShape.maxSentences < webContract.responseShape.maxSentences);
});

// ── Truth Flags ──
console.log("\nTruth flags enforced:");

test("forbidFakeCompletion === true on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(forbidFakeCompletion(c), true, `${c.surface} forbidFakeCompletion must be true`);
  }
});

test("forbidPreparedAsExecuted === true on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(forbidPreparedAsExecuted(c), true, `${c.surface} forbidPreparedAsExecuted must be true`);
  }
});

test("forbidHandoffAsDelivered === true on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(forbidHandoffAsDelivered(c), true, `${c.surface} forbidHandoffAsDelivered must be true`);
  }
});

test("requireTruthfulStatusLanguage === true on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(requireTruthfulStatusLanguage(c), true, `${c.surface} requireTruthfulStatusLanguage must be true`);
  }
});

test("preferExplicitBlockedExplanation === true on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(preferExplicitBlockedExplanation(c), true, `${c.surface} preferExplicitBlockedExplanation must be true`);
  }
});

test("checkTruthfulWording detects fake completion in prepared", () => {
  const violations = checkTruthfulWording("Task executed successfully", "prepared", voiceContract);
  assert.ok(violations.length > 0);
});

test("checkTruthfulWording detects handoff-as-delivered", () => {
  const violations = checkTruthfulWording("Delivered to the user", "handedOff", voiceContract);
  assert.ok(violations.length > 0);
});

test("checkTruthfulWording passes for correct prepared wording", () => {
  const violations = checkTruthfulWording("Prepared and ready to launch", "prepared", voiceContract);
  assert.equal(violations.length, 0);
});

// ── Turn-Taking Rules ──
console.log("\nTurn-taking rules:");

test("clarifyBeforeAction === true on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(shouldClarifyBeforeAction(c), true, `${c.surface} clarifyBeforeAction must be true`);
  }
});

test("clarifyBeforeProtectedMeaning === true on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(shouldClarifyBeforeProtectedMeaning(c), true, `${c.surface} clarifyBeforeProtectedMeaning must be true`);
  }
});

test("prefersImmediateAnswer === true on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(prefersImmediateAnswer(c), true, `${c.surface} prefersImmediateAnswer must be true`);
  }
});

test("voice does not allow followup prompt", () => {
  assert.equal(allowsFollowupPrompt(voiceContract), false);
});

test("web allows followup prompt", () => {
  assert.equal(allowsFollowupPrompt(webContract), true);
});

test("validateTurnBehavior catches excess next steps", () => {
  const violations = validateTurnBehavior(voiceContract, { nextSteps: 2, clarifications: 1, semanticAxes: 1 });
  assert.ok(violations.length > 0);
});

test("validateTurnBehavior catches excess clarifications", () => {
  const violations = validateTurnBehavior(voiceContract, { nextSteps: 1, clarifications: 2, semanticAxes: 1 });
  assert.ok(violations.length > 0);
});

test("validateTurnBehavior catches excess semantic axes", () => {
  const violations = validateTurnBehavior(voiceContract, { nextSteps: 1, clarifications: 1, semanticAxes: 3 });
  assert.ok(violations.length > 0);
});

test("validateTurnBehavior passes for valid response", () => {
  const violations = validateTurnBehavior(voiceContract, { nextSteps: 1, clarifications: 1, semanticAxes: 1 });
  assert.equal(violations.length, 0);
});

// ── Latency Rules ──
console.log("\nLatency rules:");

test("holding phrases exist for all languages", () => {
  assert.ok(HOLDING_PHRASES.ru.length >= 3);
  assert.ok(HOLDING_PHRASES.en.length >= 3);
  assert.ok(HOLDING_PHRASES.uz.length >= 3);
});

test("picks a holding phrase", () => {
  const phrase = pickHoldingPhrase("en");
  assert.ok(phrase && phrase.length > 0);
});

test("validates holding phrase length", () => {
  assert.equal(validateHoldingPhrase("One moment.", 5), true);
  assert.equal(validateHoldingPhrase("Please wait while I process your request and prepare the response.", 5), false);
});

test("voice holding phrase max words <= 3", () => {
  assert.ok(voiceContract.latencyBehavior.holdingPhraseMaxWords <= 3);
});

test("allowsProgressiveResponse differs by surface", () => {
  assert.equal(allowsProgressiveResponse(webContract), true);
  assert.equal(allowsProgressiveResponse(voiceContract), false);
});

test("prefersFastAcknowledgeThenAnswer === true on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(prefersFastAcknowledgeThenAnswer(c), true, `${c.surface} prefersFastAcknowledgeThenAnswer must be true`);
  }
});

// ── Interruption Rules ──
console.log("\nInterruption rules:");

test("voice supportss interruption", () => {
  assert.equal(intSupports(voiceContract), true);
});

test("telegram does not support interruption", () => {
  assert.equal(intSupports(telegramContract), false);
});

test("voice restarts softly after interruption", () => {
  assert.equal(restartSoftlyAfterInterruption(voiceContract), true);
});

test("voice restates context briefly", () => {
  assert.equal(restateContextBriefly(voiceContract), true);
});

test("voice maxRecoverySentences <= 1", () => {
  assert.ok(getMaxRecoverySentences(voiceContract) <= 1);
});

test("picks a recovery phrase", () => {
  const phrase = pickRecoveryPhrase("en");
  assert.ok(phrase && phrase.length > 0);
});

test("validates recovery phrase length", () => {
  assert.equal(validateRecoveryPhrase("Where were we?", 1), true);
  assert.equal(validateRecoveryPhrase("Where were we? Let me check. One moment.", 1), false);
});

// ── Fallback Rules ──
console.log("\nFallback rules:");

test("all surfaces have fallback to text allowed", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(c.fallbackBehavior.fallbackToTextAllowed, true, `${c.surface} fallbackToTextAllowed must be true`);
  }
});

test("all surfaces have fallback to short answer allowed", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(c.fallbackBehavior.fallbackToShortAnswerAllowed, true, `${c.surface} fallbackToShortAnswerAllowed must be true`);
  }
});

test("all surfaces have fallback to clarification allowed", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(c.fallbackBehavior.fallbackToClarificationAllowed, true, `${c.surface} fallbackToClarificationAllowed must be true`);
  }
});

test("all surfaces have fallback to English allowed", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(c.fallbackBehavior.fallbackToEnglishAllowed, true, `${c.surface} fallbackToEnglishAllowed must be true`);
  }
});

// ── Shaping ──
console.log("\nShaping:");

test("shapeResponse truncates to maxSentences", () => {
  const text = "First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.";
  const shaped = shapeResponse(text, telegramContract);
  assert.equal(shaped.sentenceCount, 3);
  assert.equal(shaped.truncated, true);
  assert.equal(shaped.surface, "telegram");
});

test("shapeResponse does not truncate if within limits", () => {
  const text = "First sentence. Second sentence.";
  const shaped = shapeResponse(text, telegramContract);
  assert.equal(shaped.sentenceCount, 2);
  assert.equal(shaped.truncated, false);
});

test("countSentences returns correct count", () => {
  assert.equal(countSentences("One. Two. Three!"), 3);
  assert.equal(countSentences("Just one"), 1);
});

test("exceedsMaxSentences detects overflow", () => {
  assert.equal(exceedsMaxSentences("A. B. C. D.", voiceContract), true);
  assert.equal(exceedsMaxSentences("A. B.", voiceContract), false);
});

test("isWithinLimits checks both dimensions", () => {
  assert.equal(isWithinLimits("Short answer.", voiceContract), true);
  assert.equal(isWithinLimits("First. Second. Third.", voiceContract), false);
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("voice maxSentences <= 2", () => {
  assert.ok(voiceContract.responseShape.maxSentences <= 2);
});

test("telegram shorter than web", () => {
  assert.ok(telegramContract.responseShape.maxSentences < webContract.responseShape.maxSentences);
});

test("no surface allows fake completion", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(c.truthBehavior.forbidFakeCompletion, true);
  }
});

test("clarify rules respected on all surfaces", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.equal(c.turnTaking.clarifyBeforeAction, true);
    assert.equal(c.turnTaking.clarifyBeforeProtectedMeaning, true);
  }
});

test("no empty notes array", () => {
  for (const c of ALL_SURFACE_CONTRACTS) {
    assert.ok(c.notes && c.notes.length > 0, `${c.surface} should have notes`);
  }
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
