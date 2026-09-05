import { OverrideRegistry, executeOverride, approveOverride, rejectOverride } from "../../forge/override/index.js";
import { executeEmergencyStop, getEmergencyStopCount } from "../../forge/override/emergencyStop.js";
import type { OverrideAction, OverrideTargetType } from "../../forge/override/overrideTypes.js";
import { authMiddleware } from "../middleware/auth.js";

const VALID_ACTIONS: OverrideAction[] = ["pause", "resume", "approve", "reject", "cancel", "retry", "escalate", "emergency_stop"];
const VALID_TARGETS: OverrideTargetType[] = ["mission", "goal", "graph", "agent", "repair", "system"];

export async function registerOverrideRoute(server: any) {
  // Create override request
  server.post("/api/forge/override", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.targetType || !body.targetId || !body.action || !body.reason || !body.requestedBy) {
      return reply.status(400).send({ error: "targetType, targetId, action, reason, and requestedBy required" });
    }
    if (!VALID_ACTIONS.includes(body.action)) return reply.status(400).send({ error: `Invalid action. Valid: ${VALID_ACTIONS.join(", ")}` });
    if (!VALID_TARGETS.includes(body.targetType)) return reply.status(400).send({ error: `Invalid targetType. Valid: ${VALID_TARGETS.join(", ")}` });

    const request = OverrideRegistry.create(body.targetType, body.targetId, body.action, body.reason, body.requestedBy);
    return reply.status(201).send(request);
  });

  // List override requests
  server.get("/api/forge/override", async (req: any, reply: any) => {
    const query = req.query || {};
    if (query.status === "pending") return reply.send(OverrideRegistry.getPending());
    if (query.targetId) return reply.send(OverrideRegistry.getByTarget(query.targetId));
    return reply.send(OverrideRegistry.getAll());
  });

  // Get single request
  server.get("/api/forge/override/:id", async (req: any, reply: any) => {
    const request = OverrideRegistry.get(req.params.id);
    if (!request) return reply.status(404).send({ error: "Override request not found" });
    return reply.send(request);
  });

  // Execute override
  server.post("/api/forge/override/:id/execute", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const result = executeOverride(req.params.id);
    if (!result.success) return reply.status(400).send(result);
    return reply.send(result);
  });

  // Approve + execute
  server.post("/api/forge/override/:id/approve", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const result = approveOverride(req.params.id);
    if (!result) return reply.status(404).send({ error: "Override request not found" });
    return reply.send(result);
  });

  // Reject
  server.post("/api/forge/override/:id/reject", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const result = rejectOverride(req.params.id);
    if (!result) return reply.status(404).send({ error: "Override request not found" });
    return reply.send(result);
  });

  // Emergency stop
  server.post("/api/forge/override/emergency-stop", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.reason || !body.requestedBy) return reply.status(400).send({ error: "reason and requestedBy required" });

    const result = executeEmergencyStop(body.reason, body.requestedBy);
    return reply.send(result);
  });

  // Health
  server.get("/api/forge/override/health", async (_req: any, reply: any) => {
    return reply.send({
      ok: true,
      totalRequests: OverrideRegistry.size(),
      pendingRequests: OverrideRegistry.getPending().length,
      emergencyStops: getEmergencyStopCount(),
      timestamp: new Date().toISOString(),
    });
  });
}
