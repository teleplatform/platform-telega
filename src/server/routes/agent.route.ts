
// Agent API Routes - Runtime MVP v1

import type { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import type {
  AgentSessionId,
  AgentSessionState,
  TraceEvent,
  ForgeConfig,
  Subject,
} from "../../types/agentRuntime.js";
import { AgentSessionManager } from "../../core/agent/runtime/agentSession.js";
import { JsonlTraceWriter } from "../../core/agent/runtime/traceWriter.js";
import { ToolPolicyGate } from "../../core/agent/runtime/policyGate.js";
import { MinimalAgentRunner } from "../../core/agent/runtime/agentRunner.js";
import { EvidenceBundleSealer } from "../../core/agent/runtime/evidence/seal.js";
import { EvidenceBundleVerifier } from "../../core/agent/runtime/evidence/verify.js";
import { FileOwnershipStorage } from "../../core/agent/runtime/ownershipStorage.js";
import { authMiddleware, getAuthContext, type AuthContext } from "../../server/middleware/auth.js";
import { rateLimit, rateLimitStreamAcquire, rateLimitStreamRelease } from "../../server/middleware/rateLimit.js";

// Global instances
const traceWriter = new JsonlTraceWriter("./evidence");
const policyGate = new ToolPolicyGate({
  netFetchAllowlist: ["api.openai.com", "api.anthropic.com"],
  fsReadAllowedDirs: ["/workspace/docs", "/workspace/skills"],
  fsReadForbiddenDirs: ["/workspace/.git", "/workspace/node_modules"],
});
const evidenceSealer = new EvidenceBundleSealer();
const evidenceVerifier = new EvidenceBundleVerifier();
const sessionManager = new AgentSessionManager(traceWriter);
const ownershipStorage = new FileOwnershipStorage("./evidence");
const agentRunner = new MinimalAgentRunner(
  traceWriter,
  policyGate,
  evidenceSealer,
  "./evidence"
);

// In-memory trace storage for SSE streaming
const traceStorage = new Map<AgentSessionId, TraceEvent[]>();

/**
 * Extract session ID from request body
 * Priority:
 * 1. Direct body.sid
 * 2. Parse from body.bundle_ref (evidence://<sid>/bundle or evidence/<sid>/bundle)
 */
function sidFromBody(body: any): string | null {
  if (!body) return null;

  // 1) Direct sid
  if (typeof body.sid === "string" && body.sid.length > 0) return body.sid;

  // 2) Fallback from bundle_ref: evidence://<sid>/bundle
  const ref = body.bundle_ref ?? body.bundleRef;
  if (typeof ref === "string") {
    // Support both: evidence://sid_xxx/bundle or evidence/sid_xxx/bundle
    const m =
      ref.match(/evidence:\/\/(sid_[a-zA-Z0-9-]+)\/bundle/) ||
      ref.match(/evidence\/(sid_[a-zA-Z0-9-]+)\/bundle/);
    if (m?.[1]) return m[1];
  }

  return null;
}

// Hook trace writer to store events in memory
const originalWriteEvent = traceWriter.writeEvent.bind(traceWriter);
traceWriter.writeEvent = async (event: TraceEvent) => {
  await originalWriteEvent(event);
  const { sid } = event;
  if (!traceStorage.has(sid)) {
    traceStorage.set(sid, []);
  }
  traceStorage.get(sid)!.push(event);
};

export async function registerAgentRoute(app: FastifyInstance) {
  // POST /v1/agent/run - Start agent run
  app.post("/v1/agent/run", { preHandler: [authMiddleware, rateLimit('agent_run')] }, async (req, reply) => {
    const body = req.body as any;
    const rid = `rid_${randomUUID()}`;

    // Get auth context
    const authContext = getAuthContext(req);
    if (!authContext) {
      return reply.status(401).send({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "No valid subject found in request",
        },
      });
    }

    // Validate input
    if (!body.input?.messages || !Array.isArray(body.input.messages)) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message: "input.messages is required and must be an array",
        },
      });
    }

    // Determine allowed tools
    const tools: string[] = [];
    if (body.options?.tools?.fs_read) {
      tools.push("fs.read");
    }
    if (body.options?.tools?.net_fetch) {
      tools.push("net.fetch");
    }

    // Extract forge config if present
    const forgeConfig: ForgeConfig | undefined = body.forge;

    // Create session
    const session = await sessionManager.createSession(
      rid,
      body.options?.model || "default",
      tools,
      authContext.subject
    );

    // Store ownership
    await ownershipStorage.setOwner(session.sid, authContext.subject);

    // Transition to running state
    await sessionManager.transitionState(session.sid, "running");

    // Run agent
    const runtimeLimits = body.debug?.limits;
    const result = await agentRunner.run(session, body.input, runtimeLimits);

    // Transition to terminal state
    if (result.ok) {
      await sessionManager.transitionState(session.sid, "completed");
    } else {
      await sessionManager.transitionState(
        session.sid,
        "failed",
        result.error
      );
    }

    // Close trace
    await traceWriter.closeTrace(
      session.sid,
      result.ok ? "completed" : "failed"
    );

    // Get bundle info
    const bundle = await evidenceSealer.sealBundle(session.sid, "./evidence");

    return reply.send({
      ok: result.ok,
      sid: session.sid,
      status: result.ok ? "completed" : "failed",
      links: {
        stream: `/v1/agent/stream?sid=${session.sid}`,
        status: `/v1/agent/status?sid=${session.sid}`,
        evidence_verify: `/v1/evidence/verify`,
      },
      result: {
        assistant_message: result.assistant_message,
      },
      evidence: {
        bundle_ref: `evidence://${session.sid}/bundle`,
        bundle_hash: bundle.seal.bundle_hash,
        verify: {
          procedure: "POST /v1/evidence/verify",
          expected_ok: true,
        },
      },
    });
  });

  // GET /v1/agent/stream?sid=... - SSE stream
  app.get("/v1/agent/stream", { preHandler: [authMiddleware, rateLimit('agent_stream')] }, async (req, reply) => {
    const { sid } = req.query as { sid: AgentSessionId };

    // Get auth context
    const authContext = getAuthContext(req);
    if (!authContext) {
      return reply.status(401).send({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "No valid subject found in request",
        },
      });
    }

    // Verify ownership
    const isOwner = await ownershipStorage.verifyOwnership(sid, authContext.subject);
    if (!isOwner) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this session",
        },
      });
    }

    // Validate session exists
    const session = sessionManager.getSession(sid);
    if (!session) {
      return reply.status(404).send({
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Session ${sid} not found`,
        },
      });
    }

    // Set SSE headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");

    // Replay existing events
    const events = traceStorage.get(sid) || [];
    for (const event of events) {
      reply.raw.write(`event: trace
`);
      reply.raw.write(`id: ${event.eid}
`);
      reply.raw.write(`data: ${JSON.stringify(event)}

`);
    }

    // Stream new events as they arrive
    const interval = setInterval(() => {
      const newEvents = traceStorage.get(sid) || [];
      const lastEvent = events[events.length - 1];
      const lastEventIndex = lastEvent
        ? newEvents.findIndex((e) => e.eid === lastEvent.eid)
        : -1;

      if (lastEventIndex >= 0 && lastEventIndex < newEvents.length - 1) {
        for (let i = lastEventIndex + 1; i < newEvents.length; i++) {
          const event = newEvents[i];
          reply.raw.write(`event: trace
`);
          reply.raw.write(`id: ${event.eid}
`);
          reply.raw.write(`data: ${JSON.stringify(event)}

`);
        }
      }

      // Stop streaming if session is in terminal state
      if (
        session.state === "completed" ||
        session.state === "failed" ||
        session.state === "terminated"
      ) {
        clearInterval(interval);
        reply.raw.end();
      }
    }, 100);

    // Clean up on client disconnect
    req.raw.on("close", () => {
      clearInterval(interval);
      rateLimitStreamRelease(authContext.subject);
    });
  });

  // GET /v1/agent/status?sid=... - Get session status
  app.get("/v1/agent/status", { preHandler: [authMiddleware, rateLimit('agent_status')] }, async (req, reply) => {
    const { sid } = req.query as { sid: AgentSessionId };

    // Get auth context
    const authContext = getAuthContext(req);
    if (!authContext) {
      return reply.status(401).send({
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "No valid subject found in request",
        },
      });
    }

    // Verify ownership
    const isOwner = await ownershipStorage.verifyOwnership(sid, authContext.subject);
    if (!isOwner) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to access this session",
        },
      });
    }

    // Validate session exists
    const session = sessionManager.getSession(sid);
    if (!session) {
      return reply.status(404).send({
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `Session ${sid} not found`,
        },
      });
    }

    // Get last event ID from trace storage
    const events = traceStorage.get(sid) || [];
    const last_eid = events.length > 0 ? events[events.length - 1].eid : null;

    // Check if bundle is ready
    const bundleReady = session.state === "completed" || session.state === "failed";
    const bundle_ref = bundleReady ? `evidence://${sid}/bundle` : undefined;

    return reply.send({
      ok: true,
      sid: session.sid,
      state: session.state,
      last_eid,
      bundle_ref,
      created_at: session.created_at,
      updated_at: session.updated_at,
      started_at: session.started_at,
      completed_at: session.completed_at,
      failed_at: session.failed_at,
      terminated_at: session.terminated_at,
      terminal: session.terminal,
    });
  });

  // POST /v1/evidence/verify - Verify evidence bundle
  app.post("/v1/evidence/verify", { preHandler: [authMiddleware, rateLimit('evidence_verify')] }, async (req, reply) => {
    const auth = getAuthContext(req);
    const sid = sidFromBody((req as any).body);

    if (!sid) {
      return reply.status(400).send({
        ok: false,
        error: {
          code: "BAD_REQUEST",
          message: "Missing sid (provide body.sid or body.bundle_ref)",
        },
      });
    }

    // Verify ownership BEFORE any filesystem access (no oracle leak)
    const allowed = await ownershipStorage.verifyOwnership(sid, auth.subject);
    if (!allowed) {
      return reply.status(403).send({
        ok: false,
        error: {
          code: "FORBIDDEN",
          message: "Not owner of session",
        },
      });
    }

    // Verify bundle (read-only, reproducible)
    const result = await evidenceVerifier.verifyBundle(sid, "./evidence");

    return reply.send(result);
  });
}
