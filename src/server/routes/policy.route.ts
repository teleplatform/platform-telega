import { PolicyRegistry, evaluatePolicy, seedDefaultPolicies } from "../../forge/policy/index.js";
import type { Policy, PolicyScope, PolicySeverity } from "../../forge/policy/policyTypes.js";
import { authMiddleware } from "../middleware/auth.js";

const VALID_SCOPES: PolicyScope[] = ["system", "mission", "agent", "provider", "resource"];
const VALID_SEVERITIES: PolicySeverity[] = ["critical", "high", "medium", "low"];

// Seed default policies on module load
seedDefaultPolicies();

export async function registerPolicyRoute(server: any) {
  // Create policy
  server.post("/api/forge/policies", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.name) return reply.status(400).send({ error: "name is required" });

    const scope = VALID_SCOPES.includes(body.scope) ? body.scope : "system";
    const severity = VALID_SEVERITIES.includes(body.severity) ? body.severity : "medium";

    const policy = PolicyRegistry.add({
      name: body.name,
      description: body.description || "",
      scope,
      severity,
      enabled: body.enabled !== false,
      rules: body.rules || [],
    });

    return reply.status(201).send(policy);
  });

  // List policies
  server.get("/api/forge/policies", async (req: any, reply: any) => {
    const query = req.query || {};
    const scope = query.scope;
    const severity = query.severity;

    let result = PolicyRegistry.getAll();
    if (scope && VALID_SCOPES.includes(scope)) result = result.filter((p) => p.scope === scope);
    if (severity && VALID_SEVERITIES.includes(severity)) result = result.filter((p) => p.severity === severity);

    return reply.send(result);
  });

  // Get policy
  server.get("/api/forge/policies/:id", async (req: any, reply: any) => {
    const policy = PolicyRegistry.get(req.params.id);
    if (!policy) return reply.status(404).send({ error: "Policy not found" });
    return reply.send(policy);
  });

  // Update policy
  server.patch("/api/forge/policies/:id", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    const updates: any = {};
    if (body.name) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.scope && VALID_SCOPES.includes(body.scope)) updates.scope = body.scope;
    if (body.severity && VALID_SEVERITIES.includes(body.severity)) updates.severity = body.severity;
    if (body.enabled !== undefined) updates.enabled = body.enabled;
    if (body.rules) updates.rules = body.rules;

    const updated = PolicyRegistry.update(req.params.id, updates);
    if (!updated) return reply.status(404).send({ error: "Policy not found" });
    return reply.send(updated);
  });

  // Delete policy
  server.delete("/api/forge/policies/:id", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const ok = PolicyRegistry.delete(req.params.id);
    return reply.send({ ok });
  });

  // Evaluate context against all policies
  server.post("/api/forge/policies/evaluate", async (req: any, reply: any) => {
    const body = req.body || {};
    const context = {
      action: body.action || "unknown",
      resource: body.resource || "unknown",
      agentRole: body.agentRole,
      providerId: body.providerId,
      modelId: body.modelId,
      estimatedCostUsd: body.estimatedCostUsd,
      estimatedRuntimeMs: body.estimatedRuntimeMs,
      requiresInternet: body.requiresInternet,
      requiresLocalModel: body.requiresLocalModel,
      memoryScopes: body.memoryScopes,
      tools: body.tools,
    };

    const result = evaluatePolicy(context);
    return reply.send(result);
  });

  // Health
  server.get("/api/forge/policies/health", async (_req: any, reply: any) => {
    const all = PolicyRegistry.getAll();
    return reply.send({
      ok: true,
      policyCount: all.length,
      enabledCount: all.filter((p) => p.enabled).length,
      scopes: [...new Set(all.map((p) => p.scope))],
      timestamp: new Date().toISOString(),
    });
  });
}
