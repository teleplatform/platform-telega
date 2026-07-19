import Fastify from "fastify";
import { registerModelsRoute } from "./routes/models.js";
import { registerChatCompletionsRoute } from "./routes/chat-completions.js";
import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";
import { getAllSnapshots } from "../core/provider-health-runtime.js";
import { getRankingDiagnostics } from "../core/provider-scoring-engine.js";
import { capabilityRegistry, ALL_CAPABILITIES } from "../core/provider-capability-registry.js";
import { selectProvider, parseRouteIntent, type ProviderRouteIntent } from "../core/provider-selection-orchestrator.js";
import { gatewayAuthMiddleware } from "./auth.js";
import { listQualitySnapshots, getQualitySnapshot, getQualityConfig, type TaskType } from "../core/provider-quality-runtime.js";

const PORT = Number(process.env.TGPT_GATEWAY_PORT || "8765");
const HOST = "127.0.0.1";

async function startGateway() {
  const app = Fastify({
    logger: {
      transport:
        process.env.TELEGPT_ENV === "dev"
          ? { target: "pino-pretty" }
          : undefined,
    },
    bodyLimit: 1024 * 1024,
    trustProxy: false,
  });

  app.addHook("onRequest", async (req) => {
    (req as any).__gatewayStart = Date.now();
  });

  app.addHook("onResponse", async (req, reply) => {
    const latencyMs = Date.now() - ((req as any).__gatewayStart || Date.now());
    if (latencyMs > 30_000) {
      console.warn("[gateway:slow]", {
        method: req.method,
        url: req.url,
        latencyMs,
        status: reply.statusCode,
      });
    }
  });

  app.get("/health", async () => ({
    ok: true,
    service: "telegpt-ide-gateway",
    version: "0.1.0",
    ts: new Date().toISOString(),
  }));

  app.get("/internal/provider-health", { preHandler: [gatewayAuthMiddleware] }, async (req, reply) => {
    const snapshots = getAllSnapshots();
    return reply.send({ providers: snapshots });
  });

  app.get("/internal/provider-ranking", { preHandler: [gatewayAuthMiddleware] }, async (req, reply) => {
    const ranking = getRankingDiagnostics();
    return reply.send(ranking);
  });

  app.get("/internal/provider-capabilities", { preHandler: [gatewayAuthMiddleware] }, async (req, reply) => {
    const providers = capabilityRegistry.listProviders();
    const matrix = providers.map((id) => {
      const profile = capabilityRegistry.getProfile(id);
      return {
        providerId: id,
        capabilities: profile ? profile.capabilities : {},
      };
    });
    return reply.send({ capabilities: ALL_CAPABILITIES, providers: matrix });
  });

  app.get("/internal/provider-selection", { preHandler: [gatewayAuthMiddleware] }, async (req, reply) => {
    const model = (req.query as any).model as string | undefined;
    const strict = (req.query as any).strict === "true";
    const noFallback = (req.query as any).noFallback === "true";
    const caps = (req.query as any).capabilities;
    const requiredCapabilities = Array.isArray(caps) ? caps.filter((c: string) => ALL_CAPABILITIES.includes(c)) : [];
    const options = { strict, noFallback, requiredCapabilities } as any;
    const intent = parseRouteIntent(model, options);
    const plan = selectProvider(model, options);
    return reply.send(plan);
  });

  app.get("/internal/provider-quality", { preHandler: [gatewayAuthMiddleware] }, async (req, reply) => {
    const providerId = (req.query as any).providerId as string | undefined;
    const taskType = (req.query as any).taskType as TaskType | undefined;
    const modelId = (req.query as any).modelId as string | undefined;

    if (providerId && taskType) {
      const snap = getQualitySnapshot(providerId, taskType, modelId);
      return reply.send(snap);
    }

    const snaps = listQualitySnapshots();
    const config = getQualityConfig();
    return reply.send({ snapshots: snaps, config });
  });

  registerModelsRoute(app);
  registerChatCompletionsRoute(app);

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║  TeleGPT IDE Gateway — TGP-15A               ║");
    console.log("╠══════════════════════════════════════════════╣");
    console.log(`║  Listening:  http://${HOST}:${PORT}`);
    console.log("║  Auth:       Bearer tgpt_sk_...");
    console.log("║  Models:     GET  /v1/models");
    console.log("║  Chat:       POST /v1/chat/completions");
    console.log("║  Health:     GET  /health");
    console.log("║  Ranking:    GET  /internal/provider-ranking");
    console.log("║  Capabilities: GET /internal/provider-capabilities");
    console.log("║  Selection:  GET  /internal/provider-selection?model=kimi:kimi-k3");
    console.log("║  Quality:    GET  /internal/provider-quality?providerId=kimi_api&taskType=chat");
    console.log("╚══════════════════════════════════════════════╝\n");

    appendEvidenceRecord({
      evidence_id: `ide.gateway.started-${Date.now()}`,
      trace_id: "ide_gateway",
      job_id: "gateway_lifecycle",
      type: "execution_completed" as any,
      timestamp: new Date().toISOString(),
      payload: { port: PORT, host: HOST },
    }).catch(() => {});
  } catch (err) {
    console.error("[gateway] Failed to start:", err);
    process.exit(1);
  }
}

startGateway();
