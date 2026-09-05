import { createRecoveryPoint, getRecoveryPoint, listRecoveryPoints, verifyRecoveryPoint, getLastSafePoint } from "../../forge/recovery/recoveryPoint.js";
import { buildRollbackPlan } from "../../forge/recovery/rollbackPlan.js";
import { executeRollbackPlan } from "../../forge/recovery/rollbackExecutor.js";
import { buildResumePlan, resumeGraph } from "../../forge/recovery/resumeEngine.js";
import { authMiddleware } from "../middleware/auth.js";
import * as fs from "fs";

export async function registerRecoveryRoute(server: any) {
  // Create recovery point
  server.post("/api/forge/recovery/points", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.graphId || !body.reason) {
      return reply.status(400).send({ error: "graphId and reason required" });
    }

    const files: string[] = [];
    if (body.files && Array.isArray(body.files)) {
      for (const f of body.files) {
        if (fs.existsSync(f)) files.push(f);
      }
    }

    const point = createRecoveryPoint(
      body.graphId,
      body.jobNodeId || null,
      body.capsuleId || null,
      body.reason,
      files,
      body.artifacts || []
    );

    return reply.status(201).send(point);
  });

  // List recovery points
  server.get("/api/forge/recovery/points", async (req: any, reply: any) => {
    const graphId = (req.query as any)?.graphId as string | undefined;
    return reply.send(listRecoveryPoints(graphId));
  });

  // Get recovery point
  server.get("/api/forge/recovery/points/:id", async (req: any, reply: any) => {
    const point = getRecoveryPoint(req.params.id);
    if (!point) return reply.status(404).send({ error: "Recovery point not found" });
    return reply.send(point);
  });

  // Verify recovery point
  server.post("/api/forge/recovery/points/:id/verify", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const result = verifyRecoveryPoint(req.params.id);
    return reply.send(result);
  });

  // Build rollback plan
  server.post("/api/forge/recovery/rollback/plan", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.recoveryPointId || !body.failedJobNodeId || !body.reason) {
      return reply.status(400).send({ error: "recoveryPointId, failedJobNodeId, and reason required" });
    }

    const plan = buildRollbackPlan(
      body.recoveryPointId,
      body.failedJobNodeId,
      body.reason,
      body.impactedFiles || [],
      body.impactedArtifacts || []
    );

    if (!plan) return reply.status(404).send({ error: "Recovery point not found" });
    return reply.send(plan);
  });

  // Execute rollback plan
  server.post("/api/forge/recovery/rollback/execute", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.plan) return reply.status(400).send({ error: "plan object required" });

    const result = executeRollbackPlan(body.plan);
    return reply.send(result);
  });

  // Build resume plan
  server.post("/api/forge/recovery/resume/plan", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.graphId) return reply.status(400).send({ error: "graphId required" });

    const plan = buildResumePlan(body.graphId, body.recoveryPointId);
    if (!plan) return reply.status(404).send({ error: "Graph not found" });
    return reply.send(plan);
  });

  // Resume graph
  server.post("/api/forge/recovery/resume", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.graphId) return reply.status(400).send({ error: "graphId required" });

    const ok = resumeGraph(body.graphId);
    return reply.send({ ok });
  });

  // Health
  server.get("/api/forge/recovery/health", async (_req: any, reply: any) => {
    return reply.send({ ok: true, timestamp: new Date().toISOString() });
  });
}
