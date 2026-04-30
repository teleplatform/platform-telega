// Forge Bridge Hardening v1.0 — Unit Tests
// Run with: npx tsx tests/unit/forge-bridge/bundle.test.ts

import assert from "node:assert/strict";
import { buildProvenance } from "../../../src/forge-bridge/provenance.js";
import { buildInitialReviewState, buildReviewedState, buildApprovedState, buildBlockedReviewState } from "../../../src/forge-bridge/review.js";
import { resolveLanguage } from "../../../src/forge-bridge/language.js";
import { resolvePersona } from "../../../src/forge-bridge/persona.js";
import { buildBundle, updateBundleStatus } from "../../../src/forge-bridge/bundle.js";
import { buildSummary, buildPacketView } from "../../../src/forge-bridge/summary.js";
import {
  ForgeBundleInvalidError,
  ForgeBundlePersonaInvalidError,
} from "../../../src/forge-bridge/errors.js";

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

// ── Provenance ──
console.log("\nProvenance builder:");

test("builds minimal provenance", () => {
  const p = buildProvenance({});
  assert.equal(p.originSurface, undefined);
  assert.equal(p.originTarget, undefined);
  assert.deepEqual(p.receiptRefs, []);
});

test("builds full provenance", () => {
  const p = buildProvenance({
    originSurface: "telegram",
    originTarget: "forge_prepare_bundle",
    taskId: "task-123",
    actorId: "actor-1",
    actorRole: "operator",
    pipelineState: "artifact_ready",
    executionState: "done",
    receiptRefs: ["artifact-1"],
  });
  assert.equal(p.originSurface, "telegram");
  assert.equal(p.originTarget, "forge_prepare_bundle");
  assert.equal(p.taskId, "task-123");
  assert.equal(p.actorId, "actor-1");
  assert.equal(p.actorRole, "operator");
  assert.equal(p.pipelineState, "artifact_ready");
  assert.equal(p.executionState, "done");
  assert.deepEqual(p.receiptRefs, ["artifact-1"]);
});

// ── Review ──
console.log("\nReview state builder:");

test("initial review state is not_reviewed", () => {
  const r = buildInitialReviewState();
  assert.equal(r.reviewStatus, "not_reviewed");
});

test("reviewed state", () => {
  const r = buildReviewedState({ reviewSummary: "looks good" });
  assert.equal(r.reviewStatus, "reviewed");
  assert.equal(r.reviewSummary, "looks good");
});

test("approved state", () => {
  const r = buildApprovedState({ reviewSummary: "approved" });
  assert.equal(r.reviewStatus, "approved");
});

test("blocked review state", () => {
  const r = buildBlockedReviewState({ reviewNotes: ["issue1"] });
  assert.equal(r.reviewStatus, "blocked");
  assert.deepEqual(r.reviewNotes, ["issue1"]);
});

// ── Language Resolution ──
console.log("\nLanguage resolver (ARISHA multilingual constraint):");

test("resolves requested language (priority 1)", () => {
  const l = resolveLanguage({ requestedLanguage: "ru" });
  assert.equal(l.resolvedLanguage, "ru");
  assert.equal(l.requestedLanguage, "ru");
  assert.equal(l.multilingualReady, true);
});

test("resolves conversation language (priority 2)", () => {
  const l = resolveLanguage({ conversationLanguage: "uz" });
  assert.equal(l.resolvedLanguage, "uz");
  assert.equal(l.multilingualReady, true);
});

test("resolves profile language (priority 3)", () => {
  const l = resolveLanguage({ profileLanguage: "de" });
  assert.equal(l.resolvedLanguage, "de");
  assert.equal(l.multilingualReady, true);
});

test("resolves surface hint (priority 4)", () => {
  const l = resolveLanguage({ surfaceHint: "fr" });
  assert.equal(l.resolvedLanguage, "fr");
  assert.equal(l.multilingualReady, true);
});

test("falls back to en (priority 5)", () => {
  const l = resolveLanguage({});
  assert.equal(l.resolvedLanguage, "en");
  assert.equal(l.fallbackLanguage, "en");
  assert.equal(l.multilingualReady, false);
});

test("requested overrides conversation", () => {
  const l = resolveLanguage({ requestedLanguage: "ja", conversationLanguage: "ru" });
  assert.equal(l.resolvedLanguage, "ja");
});

// ── Persona Resolution ──
console.log("\nPersona resolver (One Persona / Multi-Language Presence):");

test("defaults to neutral", () => {
  const p = resolvePersona({});
  assert.equal(p.personaMode, "neutral");
  assert.equal(p.voiceSurface, "none");
  assert.equal(p.toneClass, "neutral");
});

test("arisha mode sets personaId", () => {
  const p = resolvePersona({ personaMode: "arisha" });
  assert.equal(p.personaMode, "arisha");
  assert.equal(p.personaId, "arisha");
});

test("neutral mode has no personaId", () => {
  const p = resolvePersona({ personaMode: "neutral" });
  assert.equal(p.personaMode, "neutral");
  assert.equal(p.personaId, undefined);
});

test("custom voice surface", () => {
  const p = resolvePersona({ voiceSurface: "telegram_voice" });
  assert.equal(p.voiceSurface, "telegram_voice");
});

test("custom tone class", () => {
  const p = resolvePersona({ toneClass: "creator" });
  assert.equal(p.toneClass, "creator");
});

test("throws on invalid persona mode", () => {
  assert.throws(
    () => resolvePersona({ personaMode: "invalid" as any }),
    ForgeBundlePersonaInvalidError
  );
});

test("throws on invalid voice surface", () => {
  assert.throws(
    () => resolvePersona({ voiceSurface: "invalid" as any }),
    ForgeBundlePersonaInvalidError
  );
});

test("throws on invalid tone class", () => {
  assert.throws(
    () => resolvePersona({ toneClass: "invalid" as any }),
    ForgeBundlePersonaInvalidError
  );
});

// ── Bundle Builder ──
console.log("\nBundle builder:");

test("builds valid bundle", () => {
  const b = buildBundle({
    artifactId: "art-1",
    source: "artifact_pipeline",
    artifactType: "code",
    intentClass: "general",
    title: "Test Bundle",
    summary: "Test summary",
    provenance: buildProvenance({}),
    review: buildInitialReviewState(),
    language: resolveLanguage({ requestedLanguage: "en" }),
    persona: resolvePersona({ personaMode: "neutral" }),
  });
  assert.ok(b.bundleId);
  assert.equal(b.artifactId, "art-1");
  assert.equal(b.source, "artifact_pipeline");
  assert.equal(b.status, "prepared");
  assert.equal(b.nextStep, "operator_review");
  assert.equal(b.artifactType, "code");
  assert.equal(b.intentClass, "general");
  assert.equal(b.title, "Test Bundle");
  assert.equal(b.summary, "Test summary");
  assert.equal(b.language.resolvedLanguage, "en");
  assert.equal(b.persona.personaMode, "neutral");
  assert.ok(b.createdAt);
  assert.ok(b.updatedAt);
});

test("throws on missing artifactId", () => {
  assert.throws(
    () => buildBundle({
      artifactId: "",
      source: "artifact_pipeline",
      artifactType: "code",
      intentClass: "general",
      title: "Test",
      summary: "Test",
      provenance: buildProvenance({}),
      review: buildInitialReviewState(),
      language: resolveLanguage({}),
      persona: resolvePersona({}),
    }),
    ForgeBundleInvalidError
  );
});

test("throws on missing title", () => {
  assert.throws(
    () => buildBundle({
      artifactId: "art-1",
      source: "artifact_pipeline",
      artifactType: "code",
      intentClass: "general",
      title: "",
      summary: "Test",
      provenance: buildProvenance({}),
      review: buildInitialReviewState(),
      language: resolveLanguage({}),
      persona: resolvePersona({}),
    }),
    ForgeBundleInvalidError
  );
});

test("prepared status -> operator_review next step", () => {
  const b = buildBundle({
    artifactId: "art-1",
    source: "artifact_pipeline",
    artifactType: "code",
    intentClass: "general",
    title: "Test",
    summary: "Test",
    provenance: buildProvenance({}),
    review: buildInitialReviewState(),
    language: resolveLanguage({}),
    persona: resolvePersona({}),
    status: "prepared",
  });
  assert.equal(b.nextStep, "operator_review");
});

test("approved_for_transfer status -> forge_ingest next step", () => {
  const b = buildBundle({
    artifactId: "art-1",
    source: "artifact_pipeline",
    artifactType: "code",
    intentClass: "general",
    title: "Test",
    summary: "Test",
    provenance: buildProvenance({}),
    review: buildInitialReviewState(),
    language: resolveLanguage({}),
    persona: resolvePersona({}),
    status: "approved_for_transfer",
  });
  assert.equal(b.nextStep, "forge_ingest");
});

test("blocked status -> blocked next step", () => {
  const b = buildBundle({
    artifactId: "art-1",
    source: "artifact_pipeline",
    artifactType: "code",
    intentClass: "general",
    title: "Test",
    summary: "Test",
    provenance: buildProvenance({}),
    review: buildInitialReviewState(),
    language: resolveLanguage({}),
    persona: resolvePersona({}),
    status: "blocked",
  });
  assert.equal(b.nextStep, "blocked");
});

test("updateBundleStatus updates status and nextStep", () => {
  const b = buildBundle({
    artifactId: "art-1",
    source: "artifact_pipeline",
    artifactType: "code",
    intentClass: "general",
    title: "Test",
    summary: "Test",
    provenance: buildProvenance({}),
    review: buildInitialReviewState(),
    language: resolveLanguage({}),
    persona: resolvePersona({}),
    status: "prepared",
  });
  const updated = updateBundleStatus(b, "approved_for_transfer");
  assert.equal(updated.status, "approved_for_transfer");
  assert.equal(updated.nextStep, "forge_ingest");
  assert.ok(updated.updatedAt >= b.updatedAt);
  assert.equal(updated.bundleId, b.bundleId);
});

// ── Summary Builder ──
console.log("\nSummary builder (5-question contract):");

test("builds summary answering 5 questions", () => {
  const b = buildBundle({
    artifactId: "art-123",
    executionId: "exec-456",
    source: "execution_target",
    artifactType: "report",
    intentClass: "analytics",
    title: "Analytics Report",
    summary: "Generated analytics report",
    provenance: buildProvenance({
      originSurface: "telegram",
      originTarget: "forge_prepare_bundle",
      taskId: "task-1",
      executionState: "completed",
    }),
    review: buildInitialReviewState(),
    language: resolveLanguage({ requestedLanguage: "ru" }),
    persona: resolvePersona({ personaMode: "arisha", toneClass: "creator" }),
    status: "prepared",
  });

  const summary = buildSummary(b);

  // Q1: What is this bundle?
  assert.ok(summary.includes("Analytics Report"));
  assert.ok(summary.includes(b.bundleId));
  assert.ok(summary.includes("prepared"));

  // Q2: Which artifact?
  assert.ok(summary.includes("art-123"));
  assert.ok(summary.includes("report"));

  // Q3: Execution path
  assert.ok(summary.includes("execution_target"));
  assert.ok(summary.includes("telegram"));
  assert.ok(summary.includes("completed"));

  // Q4: Persona/language context
  assert.ok(summary.includes("arisha"));
  assert.ok(summary.includes("ru"));
  assert.ok(summary.includes("Multilingual: ready"));

  // Q5: Next step
  assert.ok(summary.includes("operator_review"));
});

test("builds operator-readable packet view", () => {
  const b = buildBundle({
    artifactId: "art-1",
    source: "artifact_pipeline",
    artifactType: "code",
    intentClass: "general",
    title: "Code Bundle",
    summary: "Generated code",
    provenance: buildProvenance({
      originSurface: "web",
      originTarget: "forge_prepare_bundle",
      taskId: "task-1",
      actorId: "actor-1",
    }),
    traceId: "trace-1",
    review: buildInitialReviewState(),
    language: resolveLanguage({ requestedLanguage: "en" }),
    persona: resolvePersona({ personaMode: "system" }),
  });

  const pv = buildPacketView(b);

  assert.equal(pv.Title, "Code Bundle");
  assert.equal(pv.Summary, "Generated code");
  assert.equal(pv.Artifact, "art-1 (code)");
  assert.equal(pv.Source, "artifact_pipeline");
  assert.equal(pv.Persona, "system");
  assert.equal(pv.Language, "en");
  assert.equal(pv["Review status"], "not_reviewed");
  assert.equal(pv["Next step"], "operator_review");
  assert.ok(pv["Trace / provenance"].includes("surface:web"));
  assert.ok(pv["Trace / provenance"].includes("trace:trace-1"));
});

// ── Results ──
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
