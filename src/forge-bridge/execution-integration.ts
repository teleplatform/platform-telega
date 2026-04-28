// ─────────────────────────────────────────────────────────────
// FORGE BRIDGE HARDENING v1.0 — Execution Target Integration
//
// This module integrates the hardened ForgeBridgeBundle with
// the existing forge_prepare_bundle execution target pipeline.
//
// Usage: call `createBundleForForgePrepareBundle` after artifact
// generation to emit a hardened bundle alongside the existing
// execution result.
// ─────────────────────────────────────────────────────────────

import { forgeBridgeService } from "./service.js";
import type { ForgeBridgeBundle } from "./types.js";
import type { ForgeBundleProvenance } from "./types.js";

export type ForgePrepareBundleResult = {
  executionResult: {
    artifacts_count: number;
    artifacts: Array<{ name: string; path: string; bytes: number }>;
  };
  hardenedBundle: ForgeBridgeBundle;
  summary: string;
};

/**
 * Creates a hardened bundle for a forge_prepare_bundle execution.
 * This should be called AFTER artifacts are generated and the task
 * result is computed, but BEFORE the task is marked as "done".
 *
 * It is duplicate-safe: if a bundle already exists for the same
 * artifactId/executionId, it will throw ForgeBundleDuplicateError.
 */
export async function createBundleForForgePrepareBundle(input: {
  executionId: string;
  artifactId: string;
  artifactType: string;
  intentClass: string;
  title: string;
  summary: string;
  taskId?: string;
  traceId?: string;
  actorId?: string;
  actorRole?: string;
  originSurface?: ForgeBundleProvenance["originSurface"];
  requestedLanguage?: ForgeBridgeBundle["language"]["requestedLanguage"];
  profileLanguage?: ForgeBridgeBundle["language"]["profileLanguage"];
  conversationLanguage?: ForgeBridgeBundle["language"]["conversationLanguage"];
  personaMode?: ForgeBridgeBundle["persona"]["personaMode"];
}): Promise<ForgeBridgeBundle> {
  const bundle = await forgeBridgeService.createBundleFromExecution({
    executionId: input.executionId,
    artifactId: input.artifactId,
    artifactType: input.artifactType,
    intentClass: input.intentClass,
    title: input.title,
    summary: input.summary,
    actorId: input.actorId,
    actorRole: input.actorRole,
    taskId: input.taskId,
    traceId: input.traceId,
    executionState: "artifacts_generated",
    originSurface: input.originSurface,
    requestedLanguage: input.requestedLanguage,
    profileLanguage: input.profileLanguage,
    conversationLanguage: input.conversationLanguage,
    personaMode: input.personaMode,
  });

  return bundle;
}
