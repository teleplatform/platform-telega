import type { FastifyInstance } from "fastify";
import {
  listPendingExecutionApprovals,
  getExecutionApprovalRequest,
  approveExecutionApproval,
  denyExecutionApproval,
} from "../../runtime/policy/execution-approval-queue.js";
import { authMiddleware, getAuthContext } from "../middleware/auth.js";

export async function registerApprovalsRoute(app: FastifyInstance) {
  app.get("/api/approvals", async (_req, reply) => {
    const pending = listPendingExecutionApprovals();
    return reply.send(pending.map((r) => ({
      id: r.approval_id,
      status: r.status,
      title: r.task_kind || "Execution approval",
      reason: r.reason,
      missionId: (r.job_id || "").replace("mission:", ""),
      createdAt: r.created_at,
      expiresAt: r.expires_at || null,
      evidenceRef: r.trace_id || null,
    })));
  });

  app.get("/api/approvals/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const request = getExecutionApprovalRequest(id);
    if (!request) return reply.status(404).send({ error: "Approval not found" });
    return reply.send({
      id: request.approval_id,
      status: request.status,
      title: request.task_kind || "Execution approval",
      reason: request.reason,
      missionId: (request.job_id || "").replace("mission:", ""),
      createdAt: request.created_at,
      expiresAt: request.expires_at || null,
      evidenceRef: request.trace_id || null,
    });
  });

  app.post("/api/approvals/:id/approve", { preHandler: [authMiddleware] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const auth = getAuthContext(req);

    const existing = getExecutionApprovalRequest(id);
    if (!existing) return reply.status(404).send({ ok: false, error: "Approval not found" });
    if (existing.status !== "pending") return reply.status(409).send({ ok: false, error: `Approval already ${existing.status}` });

    try {
      const result = await approveExecutionApproval(id, auth.subject, String(body.reason || "Approved via UI"));
      if (!result) return reply.status(409).send({ ok: false, error: "Approval state changed" });
      return reply.send({ ok: true, status: result.status, decidedBy: auth.subject });
    } catch (e: unknown) {
      return reply.status(400).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });

  app.post("/api/approvals/:id/deny", { preHandler: [authMiddleware] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const auth = getAuthContext(req);

    const existing = getExecutionApprovalRequest(id);
    if (!existing) return reply.status(404).send({ ok: false, error: "Approval not found" });
    if (existing.status !== "pending") return reply.status(409).send({ ok: false, error: `Approval already ${existing.status}` });

    try {
      const result = await denyExecutionApproval(id, auth.subject, String(body.reason || "Denied via UI"));
      if (!result) return reply.status(409).send({ ok: false, error: "Approval state changed" });
      return reply.send({ ok: true, status: result.status, decidedBy: auth.subject });
    } catch (e: unknown) {
      return reply.status(400).send({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  });
}
