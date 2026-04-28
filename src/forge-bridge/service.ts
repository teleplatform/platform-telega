// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Service Orchestrator
//
// Main entry point for all forge-bridge operations.
// Coordinates bundle creation, language/persona resolution,
// review/approval workflow, and persistence.
// ─────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type {
  CreateBundleFromArtifactInput,
  CreateBundleFromExecutionInput,
  MarkBundleReviewedInput,
  MarkBundleApprovedInput,
  MarkBundleTransferredInput,
  GetBundleInput,
  ListRecentBundlesInput,
  GetBundlesByArtifactInput,
  ForgeBridgeBundle,
} from "./types.js";
import { buildProvenance } from "./provenance.js";
import { buildInitialReviewState } from "./review.js";
import { resolveLanguage } from "./language.js";
import { resolvePersona } from "./persona.js";
import { buildBundle, updateBundleStatus } from "./bundle.js";
import * as store from "./store.js";
import {
  ForgeBundleNotFoundError,
  ForgeBundleDuplicateError,
  ForgeBundleReviewRequiredError,
  ForgeBundleTransferBlockedError,
} from "./errors.js";

export class ForgeBridgeService {
  // -- Creation --

  async createBundleFromArtifact(
    input: CreateBundleFromArtifactInput,
  ): Promise<ForgeBridgeBundle> {
    // Duplicate-safe: check for existing bundle
    const existingId = store.findExistingBundle(input.artifactId, undefined);
    if (existingId) {
      const existing = store.getBundle(existingId);
      if (existing && existing.status !== "blocked" && existing.status !== "transferred") {
        throw new ForgeBundleDuplicateError(
          `Active bundle already exists for artifact ${input.artifactId} (bundleId: ${existingId})`,
        );
      }
    }

    const language = resolveLanguage({
      requestedLanguage: input.requestedLanguage,
      conversationLanguage: input.conversationLanguage,
      profileLanguage: input.profileLanguage,
    });

    const persona = resolvePersona({
      personaMode: input.personaMode,
    });

    const provenance = buildProvenance({
      originSurface: input.originSurface,
      originTarget: "forge_prepare_bundle",
      taskId: input.taskId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      pipelineState: "artifact_ready",
      receiptRefs: input.artifactId ? [input.artifactId] : [],
    });

    const review = buildInitialReviewState();

    const bundle = buildBundle({
      artifactId: input.artifactId,
      source: "artifact_pipeline",
      artifactType: input.artifactType,
      intentClass: input.intentClass,
      title: input.title,
      summary: input.summary,
      traceId: input.traceId,
      payloadRef: input.payloadRef,
      payloadInline: input.payloadInline,
      provenance,
      review,
      language,
      persona,
    });

    store.insertBundle(bundle);
    store.insertEvent({
      eventId: crypto.randomUUID(),
      bundleId: bundle.bundleId,
      eventType: "forge_bundle_created",
      actorId: input.actorId,
      actorRole: input.actorRole,
      createdAt: new Date().toISOString(),
    });

    return bundle;
  }

  async createBundleFromExecution(
    input: CreateBundleFromExecutionInput,
  ): Promise<ForgeBridgeBundle> {
    // Duplicate-safe: check for existing bundle
    const existingId = store.findExistingBundle(input.artifactId, input.executionId);
    if (existingId) {
      const existing = store.getBundle(existingId);
      if (existing && existing.status !== "blocked" && existing.status !== "transferred") {
        throw new ForgeBundleDuplicateError(
          `Active bundle already exists for execution ${input.executionId} (bundleId: ${existingId})`,
        );
      }
    }

    const language = resolveLanguage({
      requestedLanguage: input.requestedLanguage,
      conversationLanguage: input.conversationLanguage,
      profileLanguage: input.profileLanguage,
    });

    const persona = resolvePersona({
      personaMode: input.personaMode,
    });

    const provenance = buildProvenance({
      originSurface: input.originSurface,
      originTarget: "forge_prepare_bundle",
      taskId: input.taskId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      pipelineState: "execution_complete",
      executionState: input.executionState,
      receiptRefs: [input.artifactId, input.executionId].filter(Boolean) as string[],
    });

    const review = buildInitialReviewState();

    const bundle = buildBundle({
      artifactId: input.artifactId,
      executionId: input.executionId,
      source: "execution_target",
      artifactType: input.artifactType,
      intentClass: input.intentClass,
      title: input.title,
      summary: input.summary,
      traceId: input.traceId,
      payloadRef: input.payloadRef,
      payloadInline: input.payloadInline,
      provenance,
      review,
      language,
      persona,
    });

    store.insertBundle(bundle);
    store.insertEvent({
      eventId: crypto.randomUUID(),
      bundleId: bundle.bundleId,
      eventType: "forge_bundle_created",
      actorId: input.actorId,
      actorRole: input.actorRole,
      createdAt: new Date().toISOString(),
    });

    return bundle;
  }

  // -- Review workflow --

  async markBundleReviewed(input: MarkBundleReviewedInput): Promise<ForgeBridgeBundle> {
    const bundle = store.getBundle(input.bundleId);
    if (!bundle) {
      throw new ForgeBundleNotFoundError(input.bundleId);
    }

    bundle.review = {
      reviewStatus: "reviewed",
      reviewSummary: input.reviewSummary,
      reviewNotes: input.reviewNotes,
    };
    bundle.status = "reviewable";
    bundle.nextStep = "operator_review";
    bundle.updatedAt = new Date().toISOString();

    store.updateBundle(bundle);
    store.insertEvent({
      eventId: crypto.randomUUID(),
      bundleId: bundle.bundleId,
      eventType: "forge_bundle_reviewed",
      payload: { reviewSummary: input.reviewSummary },
      createdAt: new Date().toISOString(),
    });

    return bundle;
  }

  async markBundleApproved(input: MarkBundleApprovedInput): Promise<ForgeBridgeBundle> {
    const bundle = store.getBundle(input.bundleId);
    if (!bundle) {
      throw new ForgeBundleNotFoundError(input.bundleId);
    }

    if (bundle.review.reviewStatus === "not_reviewed") {
      throw new ForgeBundleReviewRequiredError(input.bundleId);
    }

    bundle.review = {
      ...bundle.review,
      reviewStatus: "approved",
    };
    bundle.status = "approved_for_transfer";
    bundle.nextStep = "forge_ingest";
    bundle.updatedAt = new Date().toISOString();

    store.updateBundle(bundle);
    store.insertEvent({
      eventId: crypto.randomUUID(),
      bundleId: bundle.bundleId,
      eventType: "forge_bundle_approved",
      createdAt: new Date().toISOString(),
    });

    return bundle;
  }

  async markBundleTransferred(input: MarkBundleTransferredInput): Promise<ForgeBridgeBundle> {
    const bundle = store.getBundle(input.bundleId);
    if (!bundle) {
      throw new ForgeBundleNotFoundError(input.bundleId);
    }

    if (bundle.status !== "approved_for_transfer") {
      throw new ForgeBundleTransferBlockedError(
        `Bundle must be approved_for_transfer before transfer. Current status: ${bundle.status}`,
        input.bundleId,
      );
    }

    bundle.status = "transferred";
    bundle.nextStep = "forge_manual_open";
    if (input.payloadRef) {
      bundle.payloadRef = input.payloadRef;
    }
    bundle.updatedAt = new Date().toISOString();

    store.updateBundle(bundle);
    store.insertEvent({
      eventId: crypto.randomUUID(),
      bundleId: bundle.bundleId,
      eventType: "forge_bundle_transferred",
      payload: { payloadRef: input.payloadRef },
      createdAt: new Date().toISOString(),
    });

    return bundle;
  }

  // -- Queries --

  async getBundle(input: GetBundleInput): Promise<ForgeBridgeBundle> {
    const bundle = store.getBundle(input.bundleId);
    if (!bundle) {
      throw new ForgeBundleNotFoundError(input.bundleId);
    }
    return bundle;
  }

  async listRecentBundles(input: ListRecentBundlesInput = {}): Promise<ForgeBridgeBundle[]> {
    const limit = input.limit ?? 20;
    return store.listRecent(limit);
  }

  async getBundlesByArtifact(input: GetBundlesByArtifactInput): Promise<ForgeBridgeBundle[]> {
    return store.listByArtifact(input.artifactId);
  }
}

// Singleton export for convenience
export const forgeBridgeService = new ForgeBridgeService();
