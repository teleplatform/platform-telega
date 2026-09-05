import { buildOperatorConsole } from "../../forge/operator-console/index.js";
import { OverrideRegistry } from "../../forge/override/overrideRegistry.js";
import { approveOverride, rejectOverride } from "../../forge/override/overrideExecutor.js";
import { executeCreatorAction } from "../../forge/mission-control/creatorControlActions.js";
import { authMiddleware } from "../middleware/auth.js";

export async function registerOperatorConsoleRoute(server: any) {
  // Full operator console
  server.get("/api/forge/operator/console", async (_req: any, reply: any) => {
    const console_ = buildOperatorConsole();
    return reply.send(console_);
  });

  // Summary cards only
  server.get("/api/forge/operator/summary", async (_req: any, reply: any) => {
    const console_ = buildOperatorConsole();
    return reply.send(console_.summaryCards);
  });

  // Pending approvals
  server.get("/api/forge/operator/pending", async (_req: any, reply: any) => {
    return reply.send(OverrideRegistry.getPending());
  });

  // Approve override
  server.post("/api/forge/operator/approve", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.overrideId) return reply.status(400).send({ error: "overrideId required" });
    const result = approveOverride(body.overrideId);
    if (!result) return reply.status(404).send({ error: "Override not found" });
    return reply.send(result);
  });

  // Reject override
  server.post("/api/forge/operator/reject", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.overrideId) return reply.status(400).send({ error: "overrideId required" });
    const result = rejectOverride(body.overrideId);
    if (!result) return reply.status(404).send({ error: "Override not found" });
    return reply.send(result);
  });

  // Execute action
  server.post("/api/forge/operator/action", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.action) return reply.status(400).send({ error: "action required" });
    const result = await executeCreatorAction(body.action, body.params || {});
    return reply.send(result);
  });

  // Emergency stop
  server.post("/api/forge/operator/emergency-stop", { preHandler: [authMiddleware] }, async (_req: any, reply: any) => {
    const result = await executeCreatorAction("emergency_stop", {});
    return reply.send(result);
  });

  // Health
  server.get("/api/forge/operator/health", async (_req: any, reply: any) => {
    const console_ = buildOperatorConsole();
    return reply.send({
      ok: true,
      cards: console_.summaryCards.length,
      sections: console_.sections.length,
      pending: OverrideRegistry.getPending().length,
      timestamp: new Date().toISOString(),
    });
  });
}
