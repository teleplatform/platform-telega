// Multilingual Language Pack Contract v1.0 — Unit Tests
// Run with: npx tsx tests/unit/multilingual/language-packs.test.ts

import assert from "node:assert/strict";
import { buildManifest, validateManifest } from "../../../src/multilingual/manifest.js";
import { buildUnderstandingProfile, validateUnderstandingProfile } from "../../../src/multilingual/understanding.js";
import { buildIntentMappings, validateIntentMappings, findIntentByCoreId, findIntentByExample, getProtectedIntents } from "../../../src/multilingual/intents.js";
import { buildUxPack, validateUxPack, getUxString } from "../../../src/multilingual/ux.js";
import { buildPersonaPack, validatePersonaPack, checkPersonaConsistency } from "../../../src/multilingual/persona.js";
import { buildVoicePack, validateVoicePack } from "../../../src/multilingual/voice.js";
import { buildValidationPack, validateLanguagePack, checkPersonaConsistencyAll } from "../../../src/multilingual/validation.js";
import { buildRolloutConfig, buildRollbackConfig, isLanguageEnabledFor, assertLanguageEnabledFor } from "../../../src/multilingual/rollout.js";
import { buildCapabilityMatrix, getSurfaceCapability, isSurfaceReady, isSurfaceFull } from "../../../src/multilingual/capability.js";
import { computeSafeDegradation, assertSafeDegradationApplied, getDegradationDescription } from "../../../src/multilingual/degradation.js";
import { registerPack, getPack, hasPack, listPacks, setActiveLanguage, getActiveLanguage, getDefaultLanguage, isPackReady, checkLanguageEnabled, getCapabilityMatrix, promotePack } from "../../../src/multilingual/loader.js";
import { enPack, ruPack, uzPack, dePack, frPack, esPack, jaPack } from "../../../src/multilingual/builtin/packs.js";
import {
  LanguagePackInvalidError,
  LanguagePackNotFoundError,
  LanguageRolloutBlockedError,
} from "../../../src/multilingual/errors.js";

// Auto-register builtin packs
const BUILTIN_PACKS = [enPack, ruPack, uzPack, dePack, frPack, esPack, jaPack];
for (const pack of BUILTIN_PACKS) {
  registerPack(pack);
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

// ── Manifest ──
console.log("\nManifest builder:");

test("builds valid manifest with nativeName and notes", () => {
  const m = buildManifest({
    languageCode: "en",
    languageName: "English",
    nativeName: "English",
    tier: "tier1",
    supportedSurfaces: ["web", "telegram", "voice"],
    notes: ["Reference pack"],
  });
  assert.equal(m.languageCode, "en");
  assert.equal(m.nativeName, "English");
  assert.deepEqual(m.notes, ["Reference pack"]);
  assert.equal(m.fallbackLanguage, "en");
  assert.equal(m.multilingualReady, true);
});

test("builds manifest without optional fields", () => {
  const m = buildManifest({
    languageCode: "xx",
    languageName: "Test",
    tier: "tier3",
    supportedSurfaces: ["web"],
  });
  assert.equal(m.nativeName, undefined);
  assert.equal(m.notes, undefined);
});

test("throws on empty languageCode", () => {
  assert.throws(
    () => buildManifest({ languageCode: "", languageName: "Test", tier: "tier1", supportedSurfaces: ["web"] }),
    LanguagePackInvalidError,
  );
});

test("throws on invalid tier", () => {
  assert.throws(
    () => buildManifest({ languageCode: "xx", languageName: "Test", tier: "tier4" as any, supportedSurfaces: ["web"] }),
    LanguagePackInvalidError,
  );
});

test("throws on invalid surface", () => {
  assert.throws(
    () => buildManifest({ languageCode: "xx", languageName: "Test", tier: "tier1", supportedSurfaces: ["invalid"] as any }),
    LanguagePackInvalidError,
  );
});

test("validates manifest", () => {
  const errors = validateManifest(enPack.manifest);
  assert.equal(errors.length, 0);
});

test("detects invalid manifest", () => {
  const errors = validateManifest({ ...enPack.manifest, languageCode: "" });
  assert.ok(errors.length > 0);
});

// ── Understanding Profile ──
console.log("\nUnderstanding profile builder:");

test("builds valid understanding profile with localeHints", () => {
  const u = buildUnderstandingProfile({
    intentMappingsVersion: "v1",
    entityBehavior: "strict",
    ambiguityPolicy: "clarify",
    protectedIntentHandling: "deny_or_clarify",
    localeHints: ["en-US", "en-GB"],
  });
  assert.equal(u.intentMappingsVersion, "v1");
  assert.deepEqual(u.localeHints, ["en-US", "en-GB"]);
});

test("builds understanding profile without localeHints", () => {
  const u = buildUnderstandingProfile({
    intentMappingsVersion: "v1",
    entityBehavior: "strict",
    ambiguityPolicy: "clarify",
    protectedIntentHandling: "deny_or_clarify",
  });
  assert.equal(u.localeHints, undefined);
});

test("throws on invalid entityBehavior", () => {
  assert.throws(
    () => buildUnderstandingProfile({
      intentMappingsVersion: "v1",
      entityBehavior: "invalid" as any,
      ambiguityPolicy: "clarify",
      protectedIntentHandling: "deny_or_clarify",
    }),
    LanguagePackInvalidError,
  );
});

test("throws on invalid ambiguityPolicy", () => {
  assert.throws(
    () => buildUnderstandingProfile({
      intentMappingsVersion: "v1",
      entityBehavior: "strict",
      ambiguityPolicy: "invalid" as any,
      protectedIntentHandling: "deny_or_clarify",
    }),
    LanguagePackInvalidError,
  );
});

test("validates understanding profile", () => {
  const errors = validateUnderstandingProfile(enPack.understanding);
  assert.equal(errors.length, 0);
});

// ── Intent Mappings ──
console.log("\nIntent mappings builder:");

test("builds valid intent mappings", () => {
  const m = buildIntentMappings({
    version: "v1",
    intents: [
      { coreIntentId: "ask_help", examples: ["Help me", "I need help"], aliases: ["help"], protected: false },
      { coreIntentId: "cancel", examples: ["Stop", "Cancel"], protected: true },
    ],
  });
  assert.equal(m.version, "v1");
  assert.equal(m.intents.length, 2);
  assert.equal(m.intents[0].coreIntentId, "ask_help");
  assert.equal(m.intents[1].protected, true);
});

test("throws on empty intents list", () => {
  assert.throws(
    () => buildIntentMappings({ version: "v1", intents: [] }),
    LanguagePackInvalidError,
  );
});

test("throws on missing coreIntentId", () => {
  assert.throws(
    () => buildIntentMappings({ version: "v1", intents: [{ coreIntentId: "", examples: ["test"] }] }),
    LanguagePackInvalidError,
  );
});

test("throws on empty examples", () => {
  assert.throws(
    () => buildIntentMappings({ version: "v1", intents: [{ coreIntentId: "test", examples: [] }] }),
    LanguagePackInvalidError,
  );
});

test("validates intent mappings", () => {
  const errors = validateIntentMappings(enPack.intents);
  assert.equal(errors.length, 0);
});

test("findIntentByCoreId finds intent", () => {
  const intent = findIntentByCoreId(enPack.intents, "ask_help");
  assert.ok(intent);
  assert.equal(intent!.coreIntentId, "ask_help");
});

test("findIntentByCoreId returns undefined for missing", () => {
  const intent = findIntentByCoreId(enPack.intents, "nonexistent");
  assert.equal(intent, undefined);
});

test("findIntentByExample finds by example text", () => {
  const intent = findIntentByExample(enPack.intents, "help");
  assert.ok(intent);
});

test("getProtectedIntents returns only protected intents", () => {
  const protectedIntents = getProtectedIntents(enPack.intents);
  assert.ok(protectedIntents.length > 0);
  for (const intent of protectedIntents) {
    assert.equal(intent.protected, true);
  }
});

// ── UX Pack ──
console.log("\nUX pack builder:");

test("builds valid UX pack with blocked and safeFailure", () => {
  const ux = buildUxPack({
    greetings: { default: "Hello!" },
    confirmations: { yes: "Yes" },
    clarifications: { uncertain: "Not sure" },
    help: { default: "Help?" },
    errors: { default: "Error" },
    delivery: { sending: "Sending" },
    taskStatus: { queued: "Queued" },
    blocked: { default: "Blocked" },
    safeFailure: { default: "Safe failure" },
  });
  assert.equal(ux.greetings.default, "Hello!");
  assert.equal(ux.blocked.default, "Blocked");
  assert.equal(ux.safeFailure.default, "Safe failure");
});

test("throws on empty blocked", () => {
  assert.throws(
    () => buildUxPack({
      greetings: { default: "Hello!" },
      confirmations: { yes: "Yes" },
      clarifications: { uncertain: "Not sure" },
      help: { default: "Help?" },
      errors: { default: "Error" },
      delivery: { sending: "Sending" },
      taskStatus: { queued: "Queued" },
      blocked: {},
      safeFailure: { default: "Safe failure" },
    }),
    LanguagePackInvalidError,
  );
});

test("throws on empty safeFailure", () => {
  assert.throws(
    () => buildUxPack({
      greetings: { default: "Hello!" },
      confirmations: { yes: "Yes" },
      clarifications: { uncertain: "Not sure" },
      help: { default: "Help?" },
      errors: { default: "Error" },
      delivery: { sending: "Sending" },
      taskStatus: { queued: "Queued" },
      blocked: { default: "Blocked" },
      safeFailure: {},
    }),
    LanguagePackInvalidError,
  );
});

test("validates UX pack", () => {
  const errors = validateUxPack(enPack.ux);
  assert.equal(errors.length, 0);
});

test("gets UX string by category and key", () => {
  const greeting = getUxString(enPack.ux, "greetings", "default");
  assert.equal(greeting, "Hello!");
});

test("returns undefined for missing UX key", () => {
  const missing = getUxString(enPack.ux, "greetings", "nonexistent");
  assert.equal(missing, undefined);
});

test("gets blocked UX string", () => {
  const blocked = getUxString(enPack.ux, "blocked", "default");
  assert.ok(blocked);
});

test("gets safeFailure UX string", () => {
  const safe = getUxString(enPack.ux, "safeFailure", "default");
  assert.ok(safe);
});

// ── Persona Pack ──
console.log("\nPersona pack builder:");

test("builds valid persona pack", () => {
  const p = buildPersonaPack({
    personaId: "arisha",
    toneClassByMode: {
      creator: "collaborative",
      user: "helpful",
      neutral: "professional",
    },
  });
  assert.equal(p.personaId, "arisha");
  assert.equal(p.toneClassByMode.creator, "collaborative");
});

test("throws on invalid personaId", () => {
  assert.throws(
    () => buildPersonaPack({
      personaId: "other" as any,
      toneClassByMode: { creator: "c", user: "u", neutral: "n" },
    }),
    LanguagePackInvalidError,
  );
});

test("validates persona pack", () => {
  const errors = validatePersonaPack(enPack.persona);
  assert.equal(errors.length, 0);
});

test("checks persona consistency between packs", () => {
  const violations = checkPersonaConsistency(enPack.persona, ruPack.persona);
  assert.equal(violations.length, 0);
});

// ── Voice Pack ──
console.log("\nVoice pack builder:");

test("builds valid voice pack with voiceNotes", () => {
  const v = buildVoicePack({
    textReady: true,
    voiceReady: true,
    preferredVoiceSurface: "alice_bridge",
    fallbackToText: true,
    voiceNotes: ["Natural cadence", "Warm tone"],
  });
  assert.equal(v.textReady, true);
  assert.equal(v.voiceReady, true);
  assert.deepEqual(v.voiceNotes, ["Natural cadence", "Warm tone"]);
});

test("builds voice pack without voiceNotes", () => {
  const v = buildVoicePack({
    textReady: true,
    voiceReady: false,
    fallbackToText: true,
  });
  assert.equal(v.voiceNotes, undefined);
});

test("throws on invalid voice surface", () => {
  assert.throws(
    () => buildVoicePack({
      textReady: true,
      voiceReady: false,
      preferredVoiceSurface: "invalid" as any,
      fallbackToText: true,
    }),
    LanguagePackInvalidError,
  );
});

test("validates voice pack", () => {
  const errors = validateVoicePack(enPack.voice!);
  assert.equal(errors.length, 0);
});

// ── Rollout & Rollback Config ──
console.log("\nRollout & rollback config:");

test("builds valid rollout config", () => {
  const r = buildRolloutConfig({
    featureFlag: "lang_en",
    enabledSurfaces: ["web", "telegram"],
    enabledRoles: ["creator", "user"],
    rolloutStage: "production",
  });
  assert.equal(r.featureFlag, "lang_en");
  assert.equal(r.rolloutStage, "production");
});

test("builds default rollback config with rollbackNotes", () => {
  const rb = buildRollbackConfig({ rollbackNotes: ["Instant disable"] });
  assert.equal(rb.instantDisable, true);
  assert.equal(rb.disableBySurface, true);
  assert.equal(rb.disableByRole, true);
  assert.equal(rb.fallbackLanguage, "en");
  assert.deepEqual(rb.rollbackNotes, ["Instant disable"]);
});

test("builds rollback config without notes", () => {
  const rb = buildRollbackConfig();
  assert.equal(rb.rollbackNotes, undefined);
});

test("checks language enabled for valid surface/role", () => {
  const enabled = isLanguageEnabledFor(enPack.rollout, {
    languageCode: "en",
    surface: "web",
    role: "creator",
  });
  assert.equal(enabled, true);
});

test("checks language disabled for off stage", () => {
  const config = buildRolloutConfig({
    featureFlag: "lang_xx",
    enabledSurfaces: ["web"],
    enabledRoles: ["creator"],
    rolloutStage: "off",
  });
  const enabled = isLanguageEnabledFor(config, {
    languageCode: "xx",
    surface: "web",
    role: "creator",
  });
  assert.equal(enabled, false);
});

test("checks language disabled for wrong surface", () => {
  const uzEnabled = isLanguageEnabledFor(uzPack.rollout, {
    languageCode: "uz",
    surface: "voice",
    role: "creator",
  });
  assert.equal(uzEnabled, false);
});

test("assertLanguageEnabledFor throws on blocked", () => {
  const config = buildRolloutConfig({
    featureFlag: "lang_xx",
    enabledSurfaces: ["web"],
    enabledRoles: ["creator"],
    rolloutStage: "off",
  });
  assert.throws(
    () => assertLanguageEnabledFor(config, { languageCode: "xx", surface: "web", role: "creator" }),
    LanguageRolloutBlockedError,
  );
});

// ── Capability Matrix ──
console.log("\nCapability matrix:");

test("builds valid capability matrix with operator surface", () => {
  const m = buildCapabilityMatrix({
    web: "full",
    tgm: "text_ready",
    telegram: "full",
    voice: "none",
    operator: "text_ready",
    safeActions: true,
    protectedActions: true,
  });
  assert.equal(m.web, "full");
  assert.equal(m.tgm, "text_ready");
  assert.equal(m.operator, "text_ready");
  assert.equal(m.safeActions, true);
});

test("getSurfaceCapability returns correct level", () => {
  const m = buildCapabilityMatrix({
    web: "full",
    tgm: "text_ready",
    telegram: "none",
    voice: "none",
    operator: "text_ready",
    safeActions: true,
    protectedActions: true,
  });
  assert.equal(getSurfaceCapability(m, "web"), "full");
  assert.equal(getSurfaceCapability(m, "operator"), "text_ready");
});

test("isSurfaceReady returns false for none", () => {
  const m = buildCapabilityMatrix({
    web: "none",
    tgm: "text_ready",
    telegram: "full",
    voice: "none",
    operator: "text_ready",
    safeActions: true,
    protectedActions: true,
  });
  assert.equal(isSurfaceReady(m, "web"), false);
  assert.equal(isSurfaceReady(m, "telegram"), true);
});

test("isSurfaceFull returns true only for full", () => {
  const m = buildCapabilityMatrix({
    web: "full",
    tgm: "text_ready",
    telegram: "none",
    voice: "none",
    operator: "full",
    safeActions: true,
    protectedActions: true,
  });
  assert.equal(isSurfaceFull(m, "web"), true);
  assert.equal(isSurfaceFull(m, "tgm"), false);
  assert.equal(isSurfaceFull(m, "operator"), true);
});

// ── Safe Degradation ──
console.log("\nSafe degradation:");

test("intent uncertainty → clarify", () => {
  const result = computeSafeDegradation({
    languageCode: "ru",
    surface: "telegram",
    uncertaintyType: "intent",
  });
  assert.equal(result.action, "clarify");
  assert.equal(result.targetLanguage, "ru");
});

test("entity uncertainty → clarify", () => {
  const result = computeSafeDegradation({
    languageCode: "en",
    surface: "web",
    uncertaintyType: "entity",
  });
  assert.equal(result.action, "clarify");
});

test("protected action → decline_action", () => {
  const result = computeSafeDegradation({
    languageCode: "ru",
    surface: "telegram",
    uncertaintyType: "protected_action",
  });
  assert.equal(result.action, "decline_action");
  assert.equal(result.targetLanguage, "en");
});

test("voice not ready → safe_text_fallback", () => {
  const result = computeSafeDegradation({
    languageCode: "uz",
    surface: "voice",
    uncertaintyType: "voice_not_ready",
  });
  assert.equal(result.action, "safe_text_fallback");
});

test("surface not ready → switch_channel", () => {
  const result = computeSafeDegradation({
    languageCode: "ja",
    surface: "web",
    uncertaintyType: "surface_not_ready",
  });
  assert.equal(result.action, "switch_channel");
  assert.equal(result.targetLanguage, "en");
});

test("assertSafeDegradationApplied passes for valid result", () => {
  const result = computeSafeDegradation({
    languageCode: "en",
    surface: "web",
    uncertaintyType: "intent",
  });
  assertSafeDegradationApplied({
    languageCode: "en",
    surface: "web",
    uncertaintyType: "intent",
  }, result);
});

test("getDegradationDescription returns description", () => {
  assert.ok(getDegradationDescription("clarify").length > 0);
  assert.ok(getDegradationDescription("decline_action").length > 0);
});

// ── Language Pack Loader/Registry ──
console.log("\nLanguage pack loader/registry:");

test("hasPack returns true for registered packs", () => {
  assert.equal(hasPack("en"), true);
  assert.equal(hasPack("ru"), true);
  assert.equal(hasPack("uz"), true);
  assert.equal(hasPack("de"), true);
  assert.equal(hasPack("fr"), true);
  assert.equal(hasPack("es"), true);
  assert.equal(hasPack("ja"), true);
});

test("hasPack returns false for unregistered languages", () => {
  assert.equal(hasPack("xx"), false);
});

test("getPack returns correct pack", () => {
  const pack = getPack("en");
  assert.equal(pack.languageCode, "en");
  assert.equal(pack.manifest.languageName, "English");
});

test("getPack throws for unregistered languages", () => {
  assert.throws(() => getPack("xx"), LanguagePackNotFoundError);
});

test("listPacks returns all registered packs", () => {
  const packs = listPacks();
  assert.ok(packs.length >= 7);
});

test("setActiveLanguage changes active language", () => {
  setActiveLanguage("ru");
  assert.equal(getActiveLanguage(), "ru");
  setActiveLanguage("en");
  assert.equal(getActiveLanguage(), "en");
});

test("getDefaultLanguage returns en", () => {
  assert.equal(getDefaultLanguage(), "en");
});

test("isPackReady returns true for production packs", () => {
  assert.equal(isPackReady("en"), true);
  assert.equal(isPackReady("ru"), true);
});

test("isPackReady returns false for non-production packs", () => {
  assert.equal(isPackReady("uz"), false);
  assert.equal(isPackReady("ja"), false);
});

test("checkLanguageEnabled returns true for enabled language", () => {
  const enabled = checkLanguageEnabled({
    languageCode: "en",
    surface: "web",
    role: "creator",
  });
  assert.equal(enabled, true);
});

test("checkLanguageEnabled returns false for disabled language", () => {
  const enabled = checkLanguageEnabled({
    languageCode: "ja",
    surface: "web",
    role: "user",
  });
  assert.equal(enabled, false);
});

test("getCapabilityMatrix returns matrix with operator surface", () => {
  const matrix = getCapabilityMatrix("en");
  assert.equal(matrix.web, "full");
  assert.equal(matrix.telegram, "full");
  assert.equal(matrix.operator, "full");
});

test("promotePack changes pack status", () => {
  const pack = getPack("es");
  const oldStatus = pack.status;
  promotePack("es", "validated");
  const newPack = getPack("es");
  assert.equal(newPack.status, "validated");
  // Restore original status
  promotePack("es", oldStatus);
  assert.equal(getPack("es").status, oldStatus);
});

// ── Validation ──
console.log("\nValidation:");

test("validateLanguagePack passes for en pack", () => {
  const errors = validateLanguagePack(enPack);
  assert.equal(errors.length, 0);
});

test("validateLanguagePack passes for ru pack", () => {
  const errors = validateLanguagePack(ruPack);
  assert.equal(errors.length, 0);
});

test("checkPersonaConsistencyAll passes for all builtin packs", () => {
  const violations = checkPersonaConsistencyAll(BUILTIN_PACKS);
  assert.equal(violations.length, 0, `Persona consistency violations: ${violations.join(", ")}`);
});

// ── Full Pack Contract Verification ──
console.log("\nFull pack contract verification (all 10 components):");

test("en pack has all 10 required components", () => {
  const p = enPack;
  assert.ok(p.manifest);
  assert.ok(p.understanding);
  assert.ok(p.intents);
  assert.ok(p.ux);
  assert.ok(p.persona);
  assert.ok(p.voice);
  assert.ok(p.validation);
  assert.ok(p.rollout);
  assert.ok(p.rollback);
  assert.ok(p.capability);
});

test("ru pack has all 10 required components", () => {
  const p = ruPack;
  assert.ok(p.manifest);
  assert.ok(p.understanding);
  assert.ok(p.intents);
  assert.ok(p.ux);
  assert.ok(p.persona);
  assert.ok(p.voice);
  assert.ok(p.validation);
  assert.ok(p.rollout);
  assert.ok(p.rollback);
  assert.ok(p.capability);
});

test("uz pack has capability operator = text_ready", () => {
  assert.equal(uzPack.capability.operator, "text_ready");
});

test("en pack rollback has instantDisable = true", () => {
  assert.equal(enPack.rollback.instantDisable, true);
});

test("en pack validation has surfaceChecks", () => {
  assert.ok(enPack.validation.surfaceChecks.length > 0);
});

test("en pack manifest has nativeName and notes", () => {
  assert.equal(enPack.manifest.nativeName, "English");
  assert.ok(enPack.manifest.notes!.length > 0);
});

test("en pack understanding has localeHints", () => {
  assert.ok(enPack.understanding.localeHints!.length > 0);
});

test("en pack voice has voiceNotes", () => {
  assert.ok(enPack.voice!.voiceNotes!.length > 0);
});

test("en pack ux has blocked section", () => {
  assert.ok(Object.keys(enPack.ux.blocked).length > 0);
});

test("en pack ux has safeFailure section", () => {
  assert.ok(Object.keys(enPack.ux.safeFailure).length > 0);
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
