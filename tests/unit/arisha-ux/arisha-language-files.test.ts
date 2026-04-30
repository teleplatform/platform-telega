// Arisha Language UX Files v1.0 — Unit Tests
// Run with: npx tsx tests/unit/arisha-ux/arisha-language-files.test.ts

import assert from "node:assert/strict";
import { arishaRuUx, arishaEnUx, arishaUzUx, BUILTIN_UX_FILES } from "../../../src/arisha-ux/builtin/index.js";
import { validateArishaUxFile, checkForbiddenPatterns } from "../../../src/arisha-ux/validators.js";
import { getArishaUxFile, getModePack, pickGreeting, pickConfirmation, pickClarification, pickRuntimeTruth, pickFallback, pickExplanation, pickHelp, pickBlocked, pickSafeFailure } from "../../../src/arisha-ux/selectors.js";
import { getUxFile, hasUxFile, listUxFiles, getActiveLanguages, validateAll, isProductionReady } from "../../../src/arisha-ux/loader.js";
import { resolveArishaContext } from "../../../src/arisha-ux/resolver.js";
import { assertPersonaConsistency, resolveModePack, getModeDescription } from "../../../src/arisha-ux/persona.js";
import { getSurfaceProfile, getPreferredLength, getMaxSentences, prefersDirectness, prefersClarifyFirst, isSurfaceVoice, isSurfaceText } from "../../../src/arisha-ux/surface.js";
import { resolveLanguage, resolvePhraseSet, pickRandomPhrase } from "../../../src/arisha-ux/fallback.js";
import type { PhraseSet } from "../../../src/arisha-ux/types.js";

// Auto-registered via builtin import
const ALL_UX_FILES = BUILTIN_UX_FILES;

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

test("loads Russian UX file", () => {
  assert.equal(arishaRuUx.languageCode, "ru");
  assert.equal(arishaRuUx.personaId, "arisha");
});

test("loads English UX file", () => {
  assert.equal(arishaEnUx.languageCode, "en");
  assert.equal(arishaEnUx.personaId, "arisha");
});

test("loads Uzbek UX file", () => {
  assert.equal(arishaUzUx.languageCode, "uz");
  assert.equal(arishaUzUx.personaId, "arisha");
});

test("registry has 3 files", () => {
  assert.equal(listUxFiles().length, 3);
});

test("hasUxFile returns true for all languages", () => {
  assert.equal(hasUxFile("ru"), true);
  assert.equal(hasUxFile("en"), true);
  assert.equal(hasUxFile("uz"), true);
});

test("hasUxFile returns false for unknown", () => {
  assert.equal(hasUxFile("de"), false);
});

test("getUxFile returns correct file", () => {
  const file = getUxFile("en");
  assert.ok(file);
  assert.equal(file!.languageCode, "en");
});

test("getActiveLanguages returns all 3", () => {
  const langs = getActiveLanguages();
  assert.ok(langs.includes("ru"));
  assert.ok(langs.includes("en"));
  assert.ok(langs.includes("uz"));
});

// ── Validation ──
console.log("\nValidation:");

test("ru UX file validates with no errors", () => {
  const errors = validateArishaUxFile(arishaRuUx);
  assert.equal(errors.length, 0, `RU validation errors: ${JSON.stringify(errors)}`);
});

test("en UX file validates with no errors", () => {
  const errors = validateArishaUxFile(arishaEnUx);
  assert.equal(errors.length, 0, `EN validation errors: ${JSON.stringify(errors)}`);
});

test("uz UX file validates with no errors", () => {
  const errors = validateArishaUxFile(arishaUzUx);
  assert.equal(errors.length, 0, `UZ validation errors: ${JSON.stringify(errors)}`);
});

test("no forbidden patterns in any UX file", () => {
  for (const file of ALL_UX_FILES) {
    const patterns = checkForbiddenPatterns(file);
    assert.equal(patterns.length, 0, `Forbidden patterns in ${file.languageCode}: ${JSON.stringify(patterns)}`);
  }
});

test("validateAll returns no errors for any language", () => {
  const results = validateAll();
  for (const [lang, errors] of results) {
    assert.equal(errors.length, 0, `${lang} errors: ${JSON.stringify(errors)}`);
  }
});

test("en and ru are production ready", () => {
  assert.equal(isProductionReady("en"), true);
  assert.equal(isProductionReady("ru"), true);
});

test("uz is not production ready (validated status)", () => {
  assert.equal(isProductionReady("uz"), false);
});

// ── Persona Consistency ──
console.log("\nPersona consistency:");

test("all files have personaId = arisha", () => {
  for (const file of ALL_UX_FILES) {
    assert.equal(assertPersonaConsistency(file), true, `${file.languageCode} persona mismatch`);
  }
});

test("creator/user/neutral split exists for all files", () => {
  for (const file of ALL_UX_FILES) {
    assert.ok(file.modeVariants.creator);
    assert.ok(file.modeVariants.user);
    assert.ok(file.modeVariants.neutral);
  }
});

test("resolveModePack returns neutral when mode is undefined", () => {
  const pack = resolveModePack(arishaEnUx);
  assert.equal(pack, arishaEnUx.modeVariants.neutral);
});

test("resolveModePack returns correct mode when specified", () => {
  const pack = resolveModePack(arishaEnUx, "creator");
  assert.equal(pack, arishaEnUx.modeVariants.creator);
});

test("getModeDescription returns non-empty string", () => {
  assert.ok(getModeDescription("creator").length > 0);
  assert.ok(getModeDescription("user").length > 0);
  assert.ok(getModeDescription("neutral").length > 0);
});

// ── Phrase Classes ──
console.log("\nPhrase classes (required packs):");

const REQUIRED_MODE_SECTIONS: (keyof typeof arishaEnUx.modeVariants.creator)[] = [
  "greetings",
  "confirmations",
  "clarifications",
  "explanations",
  "help",
  "blocked",
  "safeFailure",
];

test("all required phrase classes exist for all modes and languages", () => {
  for (const file of ALL_UX_FILES) {
    for (const mode of (["creator", "user", "neutral"] as const)) {
      for (const section of REQUIRED_MODE_SECTIONS) {
        assert.ok(file.modeVariants[mode][section], `${file.languageCode}/${mode}/${section} is missing`);
        assert.ok(file.modeVariants[mode][section].short.length > 0, `${file.languageCode}/${mode}/${section}.short is empty`);
        assert.ok(file.modeVariants[mode][section].medium.length > 0, `${file.languageCode}/${mode}/${section}.medium is empty`);
      }
    }
  }
});

test("no missing required phrase classes", () => {
  for (const file of ALL_UX_FILES) {
    for (const mode of (["creator", "user", "neutral"] as const)) {
      for (const section of REQUIRED_MODE_SECTIONS) {
        assert.ok(file.modeVariants[mode]?.[section]?.short?.length, `${file.languageCode}/${mode}/${section}.short is missing or empty`);
      }
    }
  }
});

// ── Minimum Content Rules ──
console.log("\nMinimum content rules:");

test("greetings.short ≥ 4 for all modes and languages", () => {
  for (const file of ALL_UX_FILES) {
    for (const mode of (["creator", "user", "neutral"] as const)) {
      assert.ok(
        file.modeVariants[mode].greetings.short.length >= 4,
        `${file.languageCode}/${mode} greetings.short has ${file.modeVariants[mode].greetings.short.length}, need ≥ 4`,
      );
    }
  }
});

test("confirmations.short ≥ 6 for all modes and languages", () => {
  for (const file of ALL_UX_FILES) {
    for (const mode of (["creator", "user", "neutral"] as const)) {
      assert.ok(
        file.modeVariants[mode].confirmations.short.length >= 6,
        `${file.languageCode}/${mode} confirmations.short has ${file.modeVariants[mode].confirmations.short.length}, need ≥ 6`,
      );
    }
  }
});

test("clarifications.short ≥ 5 for all modes and languages", () => {
  for (const file of ALL_UX_FILES) {
    for (const mode of (["creator", "user", "neutral"] as const)) {
      assert.ok(
        file.modeVariants[mode].clarifications.short.length >= 5,
        `${file.languageCode}/${mode} clarifications.short has ${file.modeVariants[mode].clarifications.short.length}, need ≥ 5`,
      );
    }
  }
});

test("safeFailure.short ≥ 4 for all modes and languages", () => {
  for (const file of ALL_UX_FILES) {
    for (const mode of (["creator", "user", "neutral"] as const)) {
      assert.ok(
        file.modeVariants[mode].safeFailure.short.length >= 4,
        `${file.languageCode}/${mode} safeFailure.short has ${file.modeVariants[mode].safeFailure.short.length}, need ≥ 4`,
      );
    }
  }
});

// ── Runtime Truth Pack ──
console.log("\nRuntime truth pack:");

const TRUTH_SECTIONS = ["prepared", "handedOff", "transferred", "delivered", "executed", "blocked", "reviewRequired"] as const;

test("runtime truth pack has all sections for all languages", () => {
  for (const file of ALL_UX_FILES) {
    for (const section of TRUTH_SECTIONS) {
      assert.ok(file.runtimeTruth[section], `${file.languageCode} runtimeTruth.${section} is missing`);
      assert.ok(file.runtimeTruth[section].short.length >= 3, `${file.languageCode} runtimeTruth.${section}.short has ${file.runtimeTruth[section].short.length}, need ≥ 3`);
    }
  }
});

test("no fake completion language in prepared", () => {
  for (const file of ALL_UX_FILES) {
    const prepared = file.runtimeTruth.prepared;
    for (const phrase of [...prepared.short, ...prepared.medium]) {
      // Check for explicit completion words (not "done" as part of "preparation is done")
      const lower = phrase.toLowerCase();
      const falsePositive = lower.includes("preparation is done") || lower.includes("подготовка завершена") || lower.includes("tayyorlash tugallandi");
      if (!falsePositive) {
        assert.ok(!lower.startsWith("done") && !lower.startsWith("выполнено") && !lower.startsWith("bajarildi") && !lower.startsWith("executed"), `${file.languageCode} prepared contains completion-like wording: ${phrase}`);
      }
    }
  }
});

test("no executed language inside reviewRequired", () => {
  for (const file of ALL_UX_FILES) {
    const review = file.runtimeTruth.reviewRequired;
    for (const phrase of [...review.short, ...review.medium]) {
      const lower = phrase.toLowerCase();
      assert.ok(!lower.includes("executed") && !lower.includes("выполнено") && !lower.includes("bajarildi"), `${file.languageCode} reviewRequired contains executed-like wording: ${phrase}`);
    }
  }
});

// ── Fallback Pack ──
console.log("\nFallback pack:");

const FALLBACK_SECTIONS = ["languageUncertain", "intentUncertain", "surfaceLimited", "voiceUnavailable", "safeDowngrade"] as const;

test("fallback pack has all sections for all languages", () => {
  for (const file of ALL_UX_FILES) {
    for (const section of FALLBACK_SECTIONS) {
      assert.ok(file.fallback[section], `${file.languageCode} fallback.${section} is missing`);
      assert.ok(file.fallback[section].short.length > 0, `${file.languageCode} fallback.${section}.short is empty`);
    }
  }
});

// ── Surface Behavior ──
console.log("\nSurface behavior:");

const SURFACES = ["web", "tgm", "telegram", "voice"] as const;

test("surface behavior has all surfaces for all languages", () => {
  for (const file of ALL_UX_FILES) {
    for (const surface of SURFACES) {
      const profile = file.surfaceBehavior[surface];
      assert.ok(profile, `${file.languageCode} surfaceBehavior.${surface} is missing`);
      assert.ok(profile.defaultLength, `${file.languageCode} surfaceBehavior.${surface}.defaultLength is missing`);
      assert.ok(profile.maxSentences >= 1, `${file.languageCode} surfaceBehavior.${surface}.maxSentences is < 1`);
      assert.equal(typeof profile.prefersDirectness, "boolean", `${file.languageCode} surfaceBehavior.${surface}.prefersDirectness not boolean`);
      assert.equal(typeof profile.prefersClarifyFirst, "boolean", `${file.languageCode} surfaceBehavior.${surface}.prefersClarifyFirst not boolean`);
    }
  }
});

test("voice surface prefers clarifyFirst", () => {
  for (const file of ALL_UX_FILES) {
    assert.equal(file.surfaceBehavior.voice.prefersClarifyFirst, true, `${file.languageCode} voice should prefer clarify first`);
  }
});

test("web surface allows longer responses", () => {
  for (const file of ALL_UX_FILES) {
    assert.ok(file.surfaceBehavior.web.maxSentences >= 3, `${file.languageCode} web should allow ≥ 3 sentences`);
  }
});

// ── Selectors ──
console.log("\nSelectors:");

test("getArishaUxFile returns file for en", () => {
  const file = getArishaUxFile("en");
  assert.ok(file);
  assert.equal(file!.languageCode, "en");
});

test("getArishaUxFile returns undefined for unknown language", () => {
  const file = getArishaUxFile("de");
  assert.equal(file, undefined);
});

test("getModePack returns pack for en/creator", () => {
  const pack = getModePack("en", "creator");
  assert.ok(pack);
  assert.equal(pack, arishaEnUx.modeVariants.creator);
});

test("getModePack falls back to en for unknown language", () => {
  const pack = getModePack("de");
  assert.ok(pack);
  assert.equal(pack, arishaEnUx.modeVariants.neutral);
});

test("pickGreeting returns a non-empty string", () => {
  const phrase = pickGreeting("en", "creator", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickConfirmation returns a non-empty string", () => {
  const phrase = pickConfirmation("ru", "user", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickClarification returns a non-empty string", () => {
  const phrase = pickClarification("uz", "neutral", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickExplanation returns a non-empty string", () => {
  const phrase = pickExplanation("en", "creator", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickHelp returns a non-empty string", () => {
  const phrase = pickHelp("ru", "user", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickBlocked returns a non-empty string", () => {
  const phrase = pickBlocked("en", "neutral", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickSafeFailure returns a non-empty string", () => {
  const phrase = pickSafeFailure("ru", "user", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickRuntimeTruth returns phrase for prepared", () => {
  const phrase = pickRuntimeTruth("en", "prepared", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickRuntimeTruth returns phrase for handedOff", () => {
  const phrase = pickRuntimeTruth("ru", "handedOff", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickRuntimeTruth returns phrase for transferred", () => {
  const phrase = pickRuntimeTruth("uz", "transferred", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickRuntimeTruth returns phrase for delivered", () => {
  const phrase = pickRuntimeTruth("en", "delivered", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickRuntimeTruth returns phrase for executed", () => {
  const phrase = pickRuntimeTruth("ru", "executed", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickRuntimeTruth returns phrase for blocked", () => {
  const phrase = pickRuntimeTruth("uz", "blocked", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickRuntimeTruth returns phrase for reviewRequired", () => {
  const phrase = pickRuntimeTruth("en", "reviewRequired", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickFallback returns phrase for languageUncertain", () => {
  const phrase = pickFallback("ru", "languageUncertain", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickFallback returns phrase for intentUncertain", () => {
  const phrase = pickFallback("en", "intentUncertain", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickFallback returns phrase for surfaceLimited", () => {
  const phrase = pickFallback("uz", "surfaceLimited", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickFallback returns phrase for voiceUnavailable", () => {
  const phrase = pickFallback("en", "voiceUnavailable", "short");
  assert.ok(phrase && phrase.length > 0);
});

test("pickFallback returns phrase for safeDowngrade", () => {
  const phrase = pickFallback("ru", "safeDowngrade", "short");
  assert.ok(phrase && phrase.length > 0);
});

// ── Fallback Resolution ──
console.log("\nFallback resolution:");

test("resolveLanguage returns requested if available", () => {
  const registry = new Map([["en", arishaEnUx], ["ru", arishaRuUx]]);
  const lang = resolveLanguage("ru", registry);
  assert.equal(lang, "ru");
});

test("resolveLanguage falls back to en if requested not found", () => {
  const registry = new Map([["en", arishaEnUx]]);
  const lang = resolveLanguage("de", registry);
  assert.equal(lang, "en");
});

test("resolveLanguage returns undefined if nothing found", () => {
  const registry = new Map<string, typeof arishaEnUx>();
  const lang = resolveLanguage("de", registry);
  assert.equal(lang, undefined);
});

test("resolvePhraseSet uses primary when available", () => {
  const primary: PhraseSet = { short: ["primary"], medium: ["primary"] };
  const fallback: PhraseSet = { short: ["fallback"], medium: ["fallback"] };
  const result = resolvePhraseSet(primary, fallback);
  assert.equal(result, primary);
});

test("resolvePhraseSet falls back when primary is empty", () => {
  const primary: PhraseSet = { short: [], medium: [] };
  const fallback: PhraseSet = { short: ["fallback"], medium: ["fallback"] };
  const result = resolvePhraseSet(primary, fallback);
  assert.equal(result, fallback);
});

test("resolvePhraseSet returns undefined when both empty", () => {
  const primary: PhraseSet = { short: [], medium: [] };
  const fallback: PhraseSet = { short: [], medium: [] };
  const result = resolvePhraseSet(primary, fallback);
  assert.equal(result, undefined);
});

test("pickRandomPhrase returns a phrase from the set", () => {
  const phraseSet: PhraseSet = { short: ["a", "b", "c"], medium: ["d", "e"] };
  const phrase = pickRandomPhrase(phraseSet, "short");
  assert.ok(phrase && ["a", "b", "c"].includes(phrase));
});

test("pickRandomPhrase falls back to short when length unavailable", () => {
  const phraseSet: PhraseSet = { short: ["a"], medium: ["b"] };
  const phrase = pickRandomPhrase(phraseSet, "long");
  assert.ok(phrase && ["a", "b"].includes(phrase));
});

// ── Surface Helpers ──
console.log("\nSurface helpers:");

test("getSurfaceProfile returns profile", () => {
  const profile = getSurfaceProfile(arishaEnUx, "web");
  assert.equal(profile.defaultLength, "medium");
});

test("getPreferredLength returns correct length", () => {
  assert.equal(getPreferredLength(arishaEnUx, "web"), "medium");
  assert.equal(getPreferredLength(arishaEnUx, "voice"), "short");
});

test("getMaxSentences returns correct value", () => {
  assert.equal(getMaxSentences(arishaEnUx, "web"), 4);
  assert.equal(getMaxSentences(arishaEnUx, "voice"), 2);
});

test("prefersDirectness returns correct value", () => {
  assert.equal(prefersDirectness(arishaEnUx, "web"), true);
  assert.equal(prefersDirectness(arishaEnUx, "voice"), false);
});

test("prefersClarifyFirst returns correct value", () => {
  assert.equal(prefersClarifyFirst(arishaEnUx, "tgm"), true);
  assert.equal(prefersClarifyFirst(arishaEnUx, "web"), false);
});

test("isSurfaceVoice returns true only for voice", () => {
  assert.equal(isSurfaceVoice("voice"), true);
  assert.equal(isSurfaceVoice("web"), false);
  assert.equal(isSurfaceVoice("telegram"), false);
});

test("isSurfaceText returns true for non-voice surfaces", () => {
  assert.equal(isSurfaceText("web"), true);
  assert.equal(isSurfaceText("telegram"), true);
  assert.equal(isSurfaceText("tgm"), true);
  assert.equal(isSurfaceText("voice"), false);
});

// ── Resolver ──
console.log("\nResolver:");

test("resolveArishaContext returns context with correct file", () => {
  const ctx = resolveArishaContext(arishaEnUx, { mode: "creator", surface: "web" });
  assert.equal(ctx.file, arishaEnUx);
  assert.equal(ctx.effectiveLanguage, "en");
  assert.equal(ctx.effectiveMode, "creator");
});

test("resolveArishaContext falls back to neutral for invalid mode", () => {
  const ctx = resolveArishaContext(arishaEnUx, { mode: "invalid" as any });
  assert.equal(ctx.effectiveMode, "neutral");
});

test("resolveArishaContext uses web as default surface", () => {
  const ctx = resolveArishaContext(arishaEnUx, {});
  assert.equal(ctx.surfaceProfile.maxSentences, 4);
});

// ── Tone Sanity ──
console.log("\nTone sanity checks:");

test("no empty phrase sets anywhere", () => {
  for (const file of ALL_UX_FILES) {
    for (const mode of (["creator", "user", "neutral"] as const)) {
      for (const [sectionName, section] of Object.entries(file.modeVariants[mode])) {
        const phraseSet = section as PhraseSet | undefined;
        if (phraseSet) {
          assert.ok(phraseSet.short.length > 0, `${file.languageCode}/${mode}/${sectionName}.short is empty`);
          assert.ok(phraseSet.medium.length > 0, `${file.languageCode}/${mode}/${sectionName}.medium is empty`);
        }
      }
    }
    // Check runtime truth
    for (const [sectionName, section] of Object.entries(file.runtimeTruth)) {
      const phraseSet = section as PhraseSet | undefined;
      if (phraseSet) {
        assert.ok(phraseSet.short.length > 0, `${file.languageCode}/runtimeTruth/${sectionName}.short is empty`);
      }
    }
    // Check fallback
    for (const [sectionName, section] of Object.entries(file.fallback)) {
      const phraseSet = section as PhraseSet | undefined;
      if (phraseSet) {
        assert.ok(phraseSet.short.length > 0, `${file.languageCode}/fallback/${sectionName}.short is empty`);
      }
    }
  }
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
