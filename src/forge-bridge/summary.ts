// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Summary Builder
//
// Bundle summary must answer 5 questions:
//   1. What is this bundle?
//   2. Which artifact was it assembled from?
//   3. What execution path has already been completed?
//   4. In what persona/language context was it created?
//   5. What is the next valid step?
// ─────────────────────────────────────────────────────────────

import type { ForgeBridgeBundle, ForgeBundlePacketView } from "./types.js";

export function buildSummary(bundle: ForgeBridgeBundle): string {
  const lines: string[] = [];

  // Q1: What is this bundle?
  lines.push(`Bundle: ${bundle.title}`);
  lines.push(`ID: ${bundle.bundleId}`);
  lines.push(`Status: ${bundle.status}`);

  // Q2: Which artifact was it assembled from?
  lines.push(`Artifact: ${bundle.artifactId} (${bundle.artifactType})`);
  if (bundle.executionId) {
    lines.push(`Execution: ${bundle.executionId}`);
  }

  // Q3: What execution path has already been completed?
  lines.push(`Source: ${bundle.source}`);
  if (bundle.provenance.originSurface) {
    lines.push(`Origin surface: ${bundle.provenance.originSurface}`);
  }
  if (bundle.provenance.taskId) {
    lines.push(`Task: ${bundle.provenance.taskId}`);
  }
  if (bundle.provenance.executionState) {
    lines.push(`Execution state: ${bundle.provenance.executionState}`);
  }

  // Q4: In what persona/language context was it created?
  lines.push(`Persona: ${bundle.persona.personaMode}${bundle.persona.personaId ? ` (${bundle.persona.personaId})` : ""}`);
  if (bundle.persona.toneClass) {
    lines.push(`Tone: ${bundle.persona.toneClass}`);
  }
  lines.push(`Language: ${bundle.language.resolvedLanguage}`);
  if (bundle.language.multilingualReady) {
    lines.push("Multilingual: ready");
  }

  // Q5: What is the next valid step?
  lines.push(`Next step: ${bundle.nextStep}`);
  if (bundle.review.reviewStatus !== "not_reviewed") {
    lines.push(`Review: ${bundle.review.reviewStatus}`);
  }

  return lines.join("\n");
}

export function buildPacketView(bundle: ForgeBridgeBundle): ForgeBundlePacketView {
  const provenanceParts: string[] = [];
  if (bundle.provenance.originSurface) provenanceParts.push(`surface:${bundle.provenance.originSurface}`);
  if (bundle.provenance.originTarget) provenanceParts.push(`target:${bundle.provenance.originTarget}`);
  if (bundle.provenance.taskId) provenanceParts.push(`task:${bundle.provenance.taskId}`);
  if (bundle.provenance.actorId) provenanceParts.push(`actor:${bundle.provenance.actorId}`);
  if (bundle.traceId) provenanceParts.push(`trace:${bundle.traceId}`);

  return {
    Title: bundle.title,
    Summary: bundle.summary,
    Artifact: `${bundle.artifactId} (${bundle.artifactType})`,
    Source: bundle.source,
    Persona: bundle.persona.personaMode,
    Language: bundle.language.resolvedLanguage,
    "Review status": bundle.review.reviewStatus,
    "Next step": bundle.nextStep,
    "Trace / provenance": provenanceParts.join(" | ") || "(none)",
  };
}
