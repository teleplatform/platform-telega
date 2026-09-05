import { runRepairLoop } from "../../forge/repair/repairLoop.js";
import { formatRepairResult } from "../../forge/repair/repairReport.js";
import { classifyFailure } from "../../forge/repair/failureClassifier.js";
import { authMiddleware } from "../middleware/auth.js";

const repairLoops = new Map<string, any>();

export async function registerRepairRoute(server: any) {
  // Run repair loop
  server.post("/api/forge/repair/run", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.graphId || !body.failedJobNodeId || !body.error) {
      return reply.status(400).send({ error: "graphId, failedJobNodeId, and error required" });
    }

    const result = await runRepairLoop(body.graphId, body.failedJobNodeId, body.error);
    repairLoops.set(result.loopId, result);
    return reply.send(result);
  });

  // Get repair result
  server.get("/api/forge/repair/:id", async (req: any, reply: any) => {
    const result = repairLoops.get(req.params.id);
    if (!result) return reply.status(404).send({ error: "Repair loop not found" });
    return reply.send(result);
  });

  // List repair loops
  server.get("/api/forge/repair", async (_req: any, reply: any) => {
    return reply.send(Array.from(repairLoops.values()));
  });

  // Classify failure
  server.post("/api/forge/repair/classify", async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.error) return reply.status(400).send({ error: "error is required" });
    const cls = classifyFailure(body.error);
    return reply.send({ classification: cls, error: body.error });
  });

  // Format result
  server.post("/api/forge/repair/format", async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.result) return reply.status(400).send({ error: "result object required" });
    return reply.send({ formatted: formatRepairResult(body.result) });
  });

  // Health
  server.get("/api/forge/repair/health", async (_req: any, reply: any) => {
    return reply.send({ ok: true, activeLoops: repairLoops.size, timestamp: new Date().toISOString() });
  });
}
