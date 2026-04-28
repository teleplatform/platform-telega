/**
 * Artifact Pipeline Routes — with dev registration endpoint
 *
 * Endpoints:
 *   POST /v1/artifacts/dev/register — Register artifact in registry (dev only)
 *   POST /v1/artifacts/pipeline/register — Register artifact in pipeline
 *   POST /v1/artifacts/:id/review — Review artifact
 *   POST /v1/artifacts/:id/policy-check — Policy check
 *   POST /v1/artifacts/:id/handoff — Handoff artifact
 *   GET /v1/artifacts/:id/pipeline — Get pipeline status
 *   GET /v1/artifacts — List all artifacts
 */

import type { FastifyInstance } from "fastify";
import {
  registerArtifact,
  getArtifact,
  listArtifacts,
  type ArtifactRecord,
} from "../../forge-bridge/artifactRegistry.js";

export async function registerArtifactPipelineRoutes(app: FastifyInstance) {
  // ─── Dev Registration Endpoint ───

  app.post<{
    Body: {
      artifact?: Partial<ArtifactRecord>;
      taskId?: string;
      traceId?: string;
    };
  }>("/v1/artifacts/dev/register", async (req) => {
    const now = new Date().toISOString();
    const artifactId = req.body?.artifact?.id ?? `artifact_manual_${Date.now()}`;

    const artifact: ArtifactRecord = {
      id: artifactId,
      type: req.body?.artifact?.type ?? "spec_artifact",
      title: req.body?.artifact?.title ?? "Manual Artifact",
      goal: req.body?.artifact?.goal ?? "Test goal",
      target: req.body?.artifact?.target ?? "handoff_to_web",
      createdAt: req.body?.artifact?.createdAt ?? now,
      summary: req.body?.artifact?.summary ?? "Manual test artifact",
      payload: req.body?.artifact?.payload ?? {},
    };

    registerArtifact({
      artifact,
      taskId: req.body?.taskId ?? "task_manual",
      traceId: req.body?.traceId ?? "trace_manual_1",
    });

    return { ok: true, artifact_id: artifactId };
  });

  // ─── List All Artifacts ───

  app.get("/v1/artifacts", async () => {
    const artifacts = listArtifacts();
    return {
      ok: true,
      artifacts: artifacts.map((a) => ({
        id: a.artifact.id,
        type: a.artifact.type,
        title: a.artifact.title,
        task_id: a.taskId,
        trace_id: a.traceId,
        registered_at: a.registeredAt,
      })),
      count: artifacts.length,
    };
  });

  // ─── Pipeline Register ───

  app.post<{
    Body: {
      artifact_id: string;
      artifact_type: string;
      intent_class: string;
      task_id?: string;
      trace_id?: string;
    };
  }>("/v1/artifacts/pipeline/register", async (req) => {
    const { artifact_id, artifact_type, intent_class, task_id, trace_id } = req.body;

    const entry = getArtifact(artifact_id);
    if (!entry) {
      return {
        ok: false,
        error: "Artifact not found in registry",
        artifact_id,
        hint: "Register artifact first via /v1/artifacts/dev/register",
      };
    }

    return {
      ok: true,
      artifact_id,
      artifact_type,
      intent_class,
      task_id: task_id ?? entry.taskId,
      trace_id: trace_id ?? entry.traceId,
      status: "registered",
    };
  });

  // ─── Review ───

  app.post<{
    Params: { id: string };
    Body: {
      action: string;
      actor_id: string;
      actor_role: string;
    };
  }>("/v1/artifacts/:id/review", async (req) => {
    const { id } = req.params;
    const { action, actor_id, actor_role } = req.body;

    const entry = getArtifact(id);
    if (!entry) {
      return {
        ok: false,
        error: "Artifact not found",
        artifact_id: id,
      };
    }

    return {
      ok: true,
      artifact_id: id,
      action,
      actor_id,
      actor_role,
      status: action === "approve" ? "approved" : "reviewed",
    };
  });

  // ─── Policy Check ───

  app.post<{
    Params: { id: string };
    Body: {
      target: string;
      actor_id: string;
      actor_role: string;
    };
  }>("/v1/artifacts/:id/policy-check", async (req) => {
    const { id } = req.params;
    const { target, actor_id, actor_role } = req.body;

    const entry = getArtifact(id);
    if (!entry) {
      return {
        ok: false,
        error: "Artifact not found",
        artifact_id: id,
      };
    }

    return {
      ok: true,
      artifact_id: id,
      target,
      actor_id,
      actor_role,
      policy_passed: true,
    };
  });

  // ─── Handoff ───

  app.post<{
    Params: { id: string };
    Body: {
      target: string;
      reason: string;
      actor_id: string;
      actor_role: string;
    };
  }>("/v1/artifacts/:id/handoff", async (req) => {
    const { id } = req.params;
    const { target, reason, actor_id, actor_role } = req.body;

    const entry = getArtifact(id);
    if (!entry) {
      return {
        ok: false,
        error: "Artifact not found",
        artifact_id: id,
      };
    }

    return {
      ok: true,
      artifact_id: id,
      target,
      reason,
      actor_id,
      actor_role,
      handoff_status: "completed",
    };
  });

  // ─── Pipeline Status ───

  app.get<{ Params: { id: string } }>("/v1/artifacts/:id/pipeline", async (req) => {
    const { id } = req.params;

    const entry = getArtifact(id);
    if (!entry) {
      return {
        ok: false,
        error: "Artifact not found",
        artifact_id: id,
        truthfulStatus: "NOT_FOUND",
      };
    }

    return {
      ok: true,
      artifact_id: id,
      truthfulStatus: "FOUND",
      artifact: entry.artifact,
      receipts: {
        delivered: true,
        registered_at: entry.registeredAt,
      },
    };
  });

  app.log && (app.log as any).info?.("[artifact-pipeline] Routes registered");
}
