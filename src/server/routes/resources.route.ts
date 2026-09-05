import { captureSnapshot, getLatestSnapshot, getHistory, getAlerts, getLatestAlerts } from "../../forge/resources/resourceMonitor.js";
import { createBudget, getBudget, getAllBudgets, evaluateResources } from "../../forge/resources/resourceBudgets.js";
import { authMiddleware } from "../middleware/auth.js";

export async function registerResourcesRoute(server: any) {
  // Capture snapshot
  server.post("/api/forge/resources/snapshot", { preHandler: [authMiddleware] }, async (_req: any, reply: any) => {
    const snapshot = await captureSnapshot();
    return reply.status(201).send(snapshot);
  });

  // Get latest snapshot
  server.get("/api/forge/resources/current", async (_req: any, reply: any) => {
    const snapshot = getLatestSnapshot();
    if (!snapshot) return reply.status(404).send({ error: "No snapshots yet" });
    return reply.send(snapshot);
  });

  // Get history
  server.get("/api/forge/resources", async (_req: any, reply: any) => {
    return reply.send(getHistory());
  });

  // Get alerts
  server.get("/api/forge/resources/alerts", async (req: any, reply: any) => {
    const limit = parseInt((req.query as any)?.limit) || 10;
    return reply.send(getLatestAlerts(limit));
  });

  // Create budget
  server.post("/api/forge/resources/budget", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.missionId) return reply.status(400).send({ error: "missionId required" });

    const budget = createBudget(
      body.missionId,
      body.maxCostUsd ?? 1.0,
      body.maxRamPercent ?? 85,
      body.maxCpuPercent ?? 90,
      body.maxConcurrentJobs ?? 5,
      body.maxTokensPerDay ?? 100000
    );
    return reply.status(201).send(budget);
  });

  // Get budget
  server.get("/api/forge/resources/budget/:missionId", async (req: any, reply: any) => {
    const budget = getBudget(req.params.missionId);
    if (!budget) return reply.status(404).send({ error: "Budget not found" });
    return reply.send(budget);
  });

  // Evaluate resources
  server.post("/api/forge/resources/evaluate", async (req: any, reply: any) => {
    const body = req.body || {};
    const snapshot = getLatestSnapshot();
    if (!snapshot) return reply.status(400).send({ error: "No snapshot available. POST /api/forge/resources/snapshot first" });

    const budget = body.missionId ? getBudget(body.missionId) : undefined;
    const decision = evaluateResources(snapshot, budget, body.modelRamGb);
    return reply.send(decision);
  });

  // Health
  server.get("/api/forge/resources/health", async (_req: any, reply: any) => {
    const snapshot = getLatestSnapshot();
    return reply.send({
      ok: true,
      hasSnapshot: snapshot !== null,
      latestCpu: snapshot?.cpuPercent ?? null,
      latestRam: snapshot?.ramPercent ?? null,
      alertCount: getAlerts().length,
      timestamp: new Date().toISOString(),
    });
  });
}
