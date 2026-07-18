import Fastify from "fastify";
import { registerModelsRoute } from "./routes/models.js";
import { registerChatCompletionsRoute } from "./routes/chat-completions.js";
import { gatewayAuthMiddleware } from "./auth.js";
import { appendEvidenceRecord } from "../runtime/evidence/execution-evidence-store.js";

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

  app.get("/v1/models", { preHandler: [gatewayAuthMiddleware] }, async () => {});
  registerModelsRoute(app);

  app.post("/v1/chat/completions", { preHandler: [gatewayAuthMiddleware] }, async () => {});
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
