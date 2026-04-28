// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Bundle Builder
//
// Assembles a ForgeBridgeBundle from resolved parts.
// Enforces all required fields and the status/next-step lattice.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { ForgeBridgeBundle, ForgeBridgeBundleStatus, ForgeBundleNextStep } from "./types.js";
import type { ForgeBundleProvenance } from "./types.js";
import type { ForgeBundleReviewState } from "./types.js";
import type { ForgeBundlePersonaContext } from "./types.js";
import type { ForgeBundleLanguageContext } from "./types.js";
import { ForgeBundleInvalidError } from "./errors.js";
import { buildSummary } from "./summary.js";

function computeNextStep(
  status: ForgeBridgeBundleStatus,
  _source: ForgeBridgeBundle["source"],
): ForgeBundleNextStep {
  // Status-to-nextStep mapping (canonical)
  switch (status) {
    case "prepared":
      return "operator_review";
    case "reviewable":
      return "operator_review";
    case "approved_for_transfer":
      return "forge_ingest";
    case "transferred":
      return "forge_manual_open";
    case "blocked":
      return "blocked";
    default:
      return "operator_review";
  }
}

export function buildBundle(input: {
  artifactId: string;
  executionId?: string;
  traceId?: string;
  source: ForgeBridgeBundle["source"];
  artifactType: string;
  intentClass: string;
  title: string;
  summary: string;
  payloadRef?: string;
  payloadInline?: Record<string, unknown>;
  provenance: ForgeBundleProvenance;
  review: ForgeBundleReviewState;
  language: ForgeBundleLanguageContext;
  persona: ForgeBundlePersonaContext;
  status?: ForgeBridgeBundleStatus;
}): ForgeBridgeBundle {
  // Validate required fields
  if (!input.artifactId || input.artifactId.trim() === "") {
    throw new ForgeBundleInvalidError("artifactId is required");
  }
  if (!input.title || input.title.trim() === "") {
    throw new ForgeBundleInvalidError("title is required");
  }
  if (!input.summary || input.summary.trim() === "") {
    throw new ForgeBundleInvalidError("summary is required");
  }
  if (!input.artifactType || input.artifactType.trim() === "") {
    throw new ForgeBundleInvalidError("artifactType is required");
  }
  if (!input.intentClass || input.intentClass.trim() === "") {
    throw new ForgeBundleInvalidError("intentClass is required");
  }

  const now = new Date().toISOString();
  const bundleId = crypto.randomUUID();

  const status = input.status ?? "prepared";

  const bundle: ForgeBridgeBundle = {
    bundleId,
    artifactId: input.artifactId,
    executionId: input.executionId,
    traceId: input.traceId,
    source: input.source,
    status,
    nextStep: computeNextStep(status, input.source),
    artifactType: input.artifactType,
    intentClass: input.intentClass,
    title: input.title,
    summary: input.summary,
    payloadRef: input.payloadRef,
    payloadInline: input.payloadInline,
    provenance: input.provenance,
    review: input.review,
    language: input.language,
    persona: input.persona,
    createdAt: now,
    updatedAt: now,
  };

  return bundle;
}

export function updateBundleStatus(
  bundle: ForgeBridgeBundle,
  newStatus: ForgeBridgeBundleStatus,
): ForgeBridgeBundle {
  return {
    ...bundle,
    status: newStatus,
    nextStep: computeNextStep(newStatus, bundle.source),
    updatedAt: new Date().toISOString(),
  };
}
