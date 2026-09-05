import { RecoveryPolicyRegistry } from "../../forge/recovery-policy/index.js";
import { authMiddleware } from "../middleware/auth.js";

export async function registerRecoveryPolicyRoute(server: any) {
  // Create recovery plan
  server.post("/api/forge/recovery-policy/plans", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.taskId || !body.graphId || !body.executionRunId || !body.error) {
      return reply.status(400).send({ error: "taskId, graphId, executionRunId, and error required" });
    }

    const plan = RecoveryPolicyRegistry.createPlan(body.taskId, body.graphId, body.executionRunId, body.error, body.currentRetryCount);
    return reply.status(201).send(plan);
  });

  // List plans
  server.get("/api/forge/recovery-policy/plans", async (req: any, reply: any) => {
    const query = req.query || {};
    if (query.taskId) return reply.send(RecoveryPolicyRegistry.listByTask(query.taskId));
    if (query.action) return reply.send(RecoveryPolicyRegistry.listByAction(query.action));
    return reply.send(RecoveryPolicyRegistry.getAll());
  });

  // Get plan
  server.get("/api/forge/recovery-policy/plans/:id", async (req: any, reply: any) => {
    const plan = RecoveryPolicyRegistry.get(req.params.id);
    if (!plan) return reply.status(404).send({ error: "Plan not found" });
    return reply.send(plan);
  });

  // Retry
  server.post("/api/forge/recovery-policy/plans/:id/retry", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const plan = RecoveryPolicyRegistry.retry(req.params.id);
    if (!plan) return reply.status(400).send({ error: "Cannot retry: plan not found or action is not retry" });
    return reply.send(plan);
  });

  // Health
  server.get("/api/forge/recovery-policy/health", async (_req: any, reply: any) => {
    return reply.send({
      ok: true,
      planCount: RecoveryPolicyRegistry.size(),
      retryPlans: RecoveryPolicyRegistry.listByAction("retry").length,
      escalatePlans: RecoveryPolicyRegistry.listByAction("escalate").length,
      stopPlans: RecoveryPolicyRegistry.listByAction("stop").length,
      timestamp: new Date().toISOString(),
    });
  });
}
