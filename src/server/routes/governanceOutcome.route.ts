import { GovernanceRegistry, buildDigest } from "../../forge/governance/index.js";
import type { OutcomeKind, OutcomeSource, OutcomeSeverity } from "../../forge/governance/governanceTypes.js";
import { authMiddleware } from "../middleware/auth.js";

const VALID_KINDS: OutcomeKind[] = [
  "mission_success", "mission_failed", "job_completed", "job_failed",
  "agent_success", "agent_failed", "provider_success", "provider_failed",
  "policy_denied", "policy_approved", "repair_succeeded", "repair_failed",
  "resource_denied", "override_executed",
];
const VALID_SOURCES: OutcomeSource[] = ["mission", "job", "agent", "provider", "policy", "repair", "resource", "override"];
const VALID_SEVERITIES: OutcomeSeverity[] = ["info", "warning", "critical"];

export async function registerGovernanceOutcomeRoute(server: any) {
  // Record outcome
  server.post("/api/forge/governance/outcomes", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.kind || !body.source || !body.summary) {
      return reply.status(400).send({ error: "kind, source, and summary required" });
    }
    if (!VALID_KINDS.includes(body.kind)) return reply.status(400).send({ error: `Invalid kind. Valid: ${VALID_KINDS.join(", ")}` });
    if (!VALID_SOURCES.includes(body.source)) return reply.status(400).send({ error: `Invalid source. Valid: ${VALID_SOURCES.join(", ")}` });

    const severity = VALID_SEVERITIES.includes(body.severity) ? body.severity : "info";
    const outcome = GovernanceRegistry.record(body.kind, body.source, severity, body.summary, body.details || {}, body.evidenceRefs || []);
    return reply.status(201).send(outcome);
  });

  // List outcomes
  server.get("/api/forge/governance/outcomes", async (_req: any, reply: any) => {
    return reply.send(GovernanceRegistry.getAll());
  });

  // Get outcome
  server.get("/api/forge/governance/outcomes/:id", async (req: any, reply: any) => {
    const outcome = GovernanceRegistry.get(req.params.id);
    if (!outcome) return reply.status(404).send({ error: "Outcome not found" });
    return reply.send(outcome);
  });

  // Query outcomes
  server.post("/api/forge/governance/outcomes/query", async (req: any, reply: any) => {
    const body = req.body || {};
    const results = GovernanceRegistry.query({
      kinds: body.kinds,
      sources: body.sources,
      severities: body.severities,
      trusted: body.trusted,
      since: body.since,
      until: body.until,
      limit: body.limit,
    });
    return reply.send(results);
  });

  // Link evidence
  server.post("/api/forge/governance/outcomes/:id/evidence", { preHandler: [authMiddleware] }, async (req: any, reply: any) => {
    const body = req.body || {};
    if (!body.evidenceRef) return reply.status(400).send({ error: "evidenceRef required" });

    const outcome = GovernanceRegistry.linkEvidence(req.params.id, body.evidenceRef);
    if (!outcome) return reply.status(404).send({ error: "Outcome not found" });
    return reply.send(outcome);
  });

  // Digest
  server.get("/api/forge/governance/outcomes/digest", async (_req: any, reply: any) => {
    const digest = buildDigest();
    return reply.send(digest);
  });

  // Health
  server.get("/api/forge/governance/outcomes/health", async (_req: any, reply: any) => {
    return reply.send({
      ok: true,
      totalOutcomes: GovernanceRegistry.size(),
      trusted: GovernanceRegistry.getAll().filter((o) => o.trusted).length,
      untrusted: GovernanceRegistry.getAll().filter((o) => !o.trusted).length,
      timestamp: new Date().toISOString(),
    });
  });
}
