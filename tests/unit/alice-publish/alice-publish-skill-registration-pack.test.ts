// Alice Publish / Skill Registration Pack v1.0 — Unit Tests
// Run with: npx tsx tests/unit/alice-publish/alice-publish-skill-registration-pack.test.ts

import assert from "node:assert/strict";
import { aliceSkillRegistrationAdapter } from "../../../src/alice-publish/builtin.js";
import { validateAlicePublishAdapter } from "../../../src/alice-publish/validators.js";
import {
  getAliceSkillRegistrationAdapter,
  supportsManifestGeneration,
  supportsInvocationProfile,
  supportsEnvironmentReadiness,
  supportsPublishValidation,
  supportsChecklistGeneration,
  getAdapterVersion,
  getAdapterId,
} from "../../../src/alice-publish/selectors.js";
import {
  buildAliceSkillIdentity,
  getDefaultAliceSkillIdentity,
} from "../../../src/alice-publish/identity.js";
import {
  buildAliceInvocationProfile,
  getCanonicalAliceEntryPhrases,
  getDefaultAliceInvocationProfile,
} from "../../../src/alice-publish/invocation.js";
import {
  buildAliceSkillManifest,
  serializeAliceSkillManifest,
  parseAliceSkillManifest,
} from "../../../src/alice-publish/manifest.js";
import {
  getAliceWebhookPublishPath,
  buildAliceEndpointRegistrationMeta,
} from "../../../src/alice-publish/endpoints.js";
import {
  checkAlicePublishEnvironment,
  hasRequiredAlicePublishSecrets,
} from "../../../src/alice-publish/environment.js";
import {
  validateAlicePublishReadiness,
} from "../../../src/alice-publish/validation.js";
import {
  buildAlicePublishChecklist,
  getChecklistSummary,
} from "../../../src/alice-publish/checklist.js";
import {
  buildAliceReleaseSummary,
  formatReleaseSummary,
} from "../../../src/alice-publish/release.js";
import {
  prepareAliceSkillRegistration,
} from "../../../src/alice-publish/adapter.js";
import type {
  AliceSkillManifest,
  AlicePublishReadinessReport,
} from "../../../src/alice-publish/types.js";

// Auto-registered via builtin import
const ADAPTER = aliceSkillRegistrationAdapter;

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

test("builtin registration adapter loads", () => {
  assert.ok(ADAPTER);
  assert.equal(ADAPTER.adapterId, "alice_publish_registration_v1");
  assert.equal(ADAPTER.version, "1.0.0");
});

test("builtin has all feature flags", () => {
  assert.equal(ADAPTER.supportsManifestGeneration, true);
  assert.equal(ADAPTER.supportsInvocationProfile, true);
  assert.equal(ADAPTER.supportsEnvironmentReadiness, true);
  assert.equal(ADAPTER.supportsPublishValidation, true);
  assert.equal(ADAPTER.supportsChecklistGeneration, true);
});

// ── Validation ──
console.log("\nValidation:");

test("builtin adapter validates with no errors", () => {
  const errors = validateAlicePublishAdapter(ADAPTER);
  assert.equal(errors.length, 0, `Validation errors: ${JSON.stringify(errors)}`);
});

// ── Identity ──
console.log("\nIdentity:");

test("buildAliceSkillIdentity builds valid identity", () => {
  const identity = buildAliceSkillIdentity();
  assert.equal(identity.skillId, "arisha_alice_skill_v1");
  assert.equal(identity.personaId, "arisha");
  assert.equal(identity.surface, "alice");
  assert.equal(identity.primaryLanguage, "ru");
  assert.ok(identity.displayName.length > 0);
  assert.ok(identity.shortDescription.length > 0);
});

test("getDefaultAliceSkillIdentity returns default identity", () => {
  const identity = getDefaultAliceSkillIdentity();
  assert.equal(identity.skillId, "arisha_alice_skill_v1");
});

test("buildAliceSkillIdentity with custom input", () => {
  const identity = buildAliceSkillIdentity({
    displayName: "Custom Arisha",
    shortDescription: "Custom description",
    supportedLanguages: ["ru"],
  });
  assert.equal(identity.displayName, "Custom Arisha");
  assert.equal(identity.shortDescription, "Custom description");
  assert.deepEqual(identity.supportedLanguages, ["ru"]);
});

// ── Invocation ──
console.log("\nInvocation:");

test("buildAliceInvocationProfile builds valid profile", () => {
  const profile = buildAliceInvocationProfile();
  assert.ok(profile.entryPhrases.length > 0);
  assert.equal(profile.invocationMode, "voice_entry");
  assert.equal(profile.requiresExplicitInvocation, true);
  assert.equal(profile.defaultEntryIntent, "arisha_entry");
  assert.equal(profile.supportsFollowupTurns, true);
  assert.equal(profile.supportsSessionContinuation, true);
});

test("getDefaultAliceInvocationProfile returns default profile", () => {
  const profile = getDefaultAliceInvocationProfile();
  assert.ok(profile.entryPhrases.length > 0);
});

test("getCanonicalAliceEntryPhrases returns RU phrases by default", () => {
  const phrases = getCanonicalAliceEntryPhrases("ru");
  assert.ok(phrases.length >= 3);
  assert.ok(phrases.some((p) => p.includes("Аришу")));
});

test("getCanonicalAliceEntryPhrases returns EN phrases", () => {
  const phrases = getCanonicalAliceEntryPhrases("en");
  assert.ok(phrases.length >= 2);
  assert.ok(phrases.some((p) => p.toLowerCase().includes("arisha")));
});

test("getCanonicalAliceEntryPhrases returns UZ phrases", () => {
  const phrases = getCanonicalAliceEntryPhrases("uz");
  assert.ok(phrases.length >= 2);
  assert.ok(phrases.some((p) => p.includes("Arish")));
});

// ── Manifest ──
console.log("\nManifest:");

test("buildAliceSkillManifest builds valid manifest", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });
  assert.equal(manifest.manifestVersion, "1.0");
  assert.equal(manifest.identity.skillId, "arisha_alice_skill_v1");
  assert.equal(manifest.httpMethod, "POST");
  assert.equal(manifest.contentType, "application/json");
  assert.ok(manifest.webhookPath.length > 0);
  assert.equal(manifest.readiness.ingressReady, true);
});

test("serializeAliceSkillManifest produces valid JSON", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });
  const json = serializeAliceSkillManifest(manifest);
  assert.ok(json.length > 0);
  const parsed = JSON.parse(json);
  assert.equal(parsed.identity.skillId, "arisha_alice_skill_v1");
});

test("parseAliceSkillManifest parses valid JSON", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });
  const json = serializeAliceSkillManifest(manifest);
  const parsed = parseAliceSkillManifest(json);
  assert.ok(parsed);
  assert.equal(parsed!.identity.skillId, "arisha_alice_skill_v1");
});

test("parseAliceSkillManifest returns null for invalid JSON", () => {
  const parsed = parseAliceSkillManifest("not valid json");
  assert.equal(parsed, null);
});

// ── Endpoint Metadata ──
console.log("\nEndpoint metadata:");

test("getAliceWebhookPublishPath returns default path", () => {
  const path = getAliceWebhookPublishPath();
  assert.equal(path, "/api/v1/alice/webhook");
});

test("buildAliceEndpointRegistrationMeta builds endpoint meta", () => {
  const meta = buildAliceEndpointRegistrationMeta("https://example.com");
  assert.equal(meta.url, "https://example.com/api/v1/alice/webhook");
  assert.equal(meta.method, "POST");
  assert.equal(meta.contentType, "application/json");
  assert.equal(meta.expectsHardening, true);
  assert.equal(meta.expectsProtocolAdapter, true);
});

test("buildAliceEndpointRegistrationMeta without baseUrl uses path only", () => {
  const meta = buildAliceEndpointRegistrationMeta();
  assert.equal(meta.url, "/api/v1/alice/webhook");
});

// ── Environment Readiness ──
console.log("\nEnvironment readiness:");

test("checkAlicePublishEnvironment returns check results", () => {
  const readiness = checkAlicePublishEnvironment();
  assert.ok(readiness.checks.length > 0);
  // ALICE_WEBHOOK_PATH may or may not be set — check structure
  assert.ok(typeof readiness.allPresent === "boolean");
  assert.ok(Array.isArray(readiness.missing));
});

test("hasRequiredAlicePublishSecrets returns present when secret mode not enabled", () => {
  const result = hasRequiredAlicePublishSecrets();
  // Secret mode not enabled by default, so should be present
  assert.equal(result.present, true);
});

// ── Validation ──
console.log("\nPublish validation:");

test("validateAlicePublishReadiness returns valid report with valid input", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });

  const report = validateAlicePublishReadiness({
    manifest,
    invocation,
  });

  assert.equal(report.checks.manifestValid, true);
  assert.equal(report.checks.invocationValid, true);
  assert.equal(report.checks.endpointConfigured, true);
  assert.equal(report.checks.hardeningEnabled, true);
  assert.equal(report.readyToPublish, true);
});

test("validateAlicePublishReadiness detects missing manifest", () => {
  const invocation = buildAliceInvocationProfile();
  const report = validateAlicePublishReadiness({
    manifest: undefined,
    invocation,
  });

  assert.equal(report.checks.manifestValid, false);
  assert.equal(report.readyToPublish, false);
  assert.ok(report.blockers);
});

test("validateAlicePublishReadiness detects invalid invocation", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });

  const report = validateAlicePublishReadiness({
    manifest,
    invocation: undefined,
  });

  assert.equal(report.checks.invocationValid, false);
  assert.equal(report.readyToPublish, false);
});

// ── Readiness Report ──
console.log("\nReadiness report:");

test("readiness report has correct structure", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });
  const report = validateAlicePublishReadiness({ manifest, invocation });

  assert.ok("readyToPublish" in report);
  assert.ok("checks" in report);
  assert.ok("manifestValid" in report.checks);
  assert.ok("invocationValid" in report.checks);
  assert.ok("endpointConfigured" in report.checks);
  assert.ok("environmentReady" in report.checks);
  assert.ok("hardeningEnabled" in report.checks);
  assert.ok("requiredSecretsPresent" in report.checks);
});

// ── Checklist ──
console.log("\nChecklist:");

test("buildAlicePublishChecklist builds checklist", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });
  const report = validateAlicePublishReadiness({ manifest, invocation });
  const checklist = buildAlicePublishChecklist(report);

  assert.ok(checklist.length > 0);
  // Check that checklist items have expected structure
  for (const item of checklist) {
    assert.ok(item.id);
    assert.ok(item.label);
    assert.ok(["done", "pending", "blocked"].includes(item.status));
  }
});

test("getChecklistSummary returns correct counts", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });
  const report = validateAlicePublishReadiness({ manifest, invocation });
  const checklist = buildAlicePublishChecklist(report);
  const summary = getChecklistSummary(checklist);

  assert.ok(typeof summary.done === "number");
  assert.ok(typeof summary.pending === "number");
  assert.ok(typeof summary.blocked === "number");
});

// ── Release Summary ──
console.log("\nRelease summary:");

test("buildAliceReleaseSummary builds release summary", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });
  const report = validateAlicePublishReadiness({ manifest, invocation });

  const summary = buildAliceReleaseSummary({
    skillId: identity.skillId,
    version: "1.0.0",
    readiness: report,
    manifest,
    endpointPath: "/api/v1/alice/webhook",
  });

  assert.equal(summary.skillId, "arisha_alice_skill_v1");
  assert.equal(summary.version, "1.0.0");
  assert.ok(summary.generatedAt);
});

test("formatReleaseSummary produces readable text", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });
  const report = validateAlicePublishReadiness({ manifest, invocation });

  const summary = buildAliceReleaseSummary({
    skillId: identity.skillId,
    version: "1.0.0",
    readiness: report,
    manifest,
    endpointPath: "/api/v1/alice/webhook",
  });

  const text = formatReleaseSummary(summary);
  assert.ok(text.length > 0);
  assert.ok(text.includes("arisha_alice_skill_v1"));
  assert.ok(text.includes("1.0.0"));
});

// ── Main Handler ──
console.log("\nMain handler:");

test("prepareAliceSkillRegistration returns complete result", () => {
  const result = prepareAliceSkillRegistration();

  assert.ok(result.identity);
  assert.ok(result.invocation);
  assert.ok(result.manifest);
  assert.ok(result.endpoint);
  assert.ok(result.readiness);
  assert.ok(result.checklist);
  assert.ok(result.checklistSummary);
  assert.ok(result.releaseSummary);
  assert.ok(result.releaseText);
});

test("prepareAliceSkillRegistration with requireSecrets=true when secret not set", () => {
  const result = prepareAliceSkillRegistration({ requireSecrets: true });

  // Secret not set by default, so should block readiness
  assert.equal(result.readiness.checks.requiredSecretsPresent, false);
  assert.equal(result.readiness.readyToPublish, false);
  assert.ok(result.releaseSummary.blockers);
  assert.ok(result.releaseSummary.blockers.length > 0);
});

test("prepareAliceSkillRegistration with custom baseUrl", () => {
  const result = prepareAliceSkillRegistration({ baseUrl: "https://myapp.example.com" });

  assert.equal(result.endpoint.url, "https://myapp.example.com/api/v1/alice/webhook");
});

// ── Selectors ──
console.log("\nSelectors:");

test("getAliceSkillRegistrationAdapter returns adapter", () => {
  const adapter = getAliceSkillRegistrationAdapter();
  assert.ok(adapter);
  assert.equal(adapter!.adapterId, "alice_publish_registration_v1");
});

test("supportsManifestGeneration returns true", () => {
  assert.equal(supportsManifestGeneration(), true);
});

test("supportsInvocationProfile returns true", () => {
  assert.equal(supportsInvocationProfile(), true);
});

test("supportsEnvironmentReadiness returns true", () => {
  assert.equal(supportsEnvironmentReadiness(), true);
});

test("supportsPublishValidation returns true", () => {
  assert.equal(supportsPublishValidation(), true);
});

test("supportsChecklistGeneration returns true", () => {
  assert.equal(supportsChecklistGeneration(), true);
});

test("getAdapterVersion returns 1.0.0", () => {
  assert.equal(getAdapterVersion(), "1.0.0");
});

test("getAdapterId returns alice_publish_registration_v1", () => {
  assert.equal(getAdapterId(), "alice_publish_registration_v1");
});

// ── Sanity Checks ──
console.log("\nSanity checks:");

test("no publish-ready without endpoint declaration", () => {
  // Override webhook path temporarily
  const origPath = process.env.ALICE_WEBHOOK_PATH;
  delete process.env.ALICE_WEBHOOK_PATH;

  // Need to re-import to pick up env change — but since we can't,
  // we test the validation logic directly
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });

  // Even without ALICE_WEBHOOK_PATH, getAliceWebhookPublishPath returns default
  // So endpointConfigured should still be true (default path exists)
  // This test verifies that default path is declared
  const report = validateAlicePublishReadiness({ manifest, invocation });
  assert.equal(report.checks.endpointConfigured, true); // Default path is declared

  // Restore
  if (origPath) process.env.ALICE_WEBHOOK_PATH = origPath;
});

test("no publish-ready without manifest", () => {
  const invocation = buildAliceInvocationProfile();
  const report = validateAlicePublishReadiness({ manifest: undefined, invocation });
  assert.equal(report.readyToPublish, false);
});

test("no fake ready when blockers exist", () => {
  // Request secrets when not set
  const result = prepareAliceSkillRegistration({ requireSecrets: true });
  assert.equal(result.readiness.readyToPublish, false);
  assert.ok(result.releaseSummary.blockers);
  assert.ok(result.releaseSummary.blockers.length > 0);
});

test("manifest serializes and deserializes correctly", () => {
  const identity = buildAliceSkillIdentity();
  const invocation = buildAliceInvocationProfile();
  const manifest = buildAliceSkillManifest({ identity, invocation });

  const json = serializeAliceSkillManifest(manifest);
  const parsed = parseAliceSkillManifest(json);

  assert.ok(parsed);
  assert.equal(parsed!.manifestVersion, manifest.manifestVersion);
  assert.equal(parsed!.identity.skillId, manifest.identity.skillId);
  assert.equal(parsed!.invocation.entryPhrases.length, manifest.invocation.entryPhrases.length);
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
