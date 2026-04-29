import "dotenv/config";
import Fastify from "fastify";
import { randomUUID } from "crypto";
import type { Socket } from "node:net";
import { routeChat } from "../core/router.js";
import type { ChatRequest, ChatResponse } from "../types/chat.js";
import { listModels } from "../core/models.js";
import { idempoHandle, idempoStats } from "./idempotency.js";
import { createSemaphore } from "./semaphore.js";
import { normalizeError } from "./errors.js";
import { registerTranslateRoute } from "./routes/translate.route.js";
import { registerModelsRoute } from "./routes/models.route.js";
import { registerJsonRoute } from "./routes/json.route.js";
import { registerChatRoute } from "./routes/chat.route.js";
import { registerAgentRoute } from "./routes/agent.route.js";
import { registerForgeRoute } from "./routes/forge.route.js";
import { registerPatchRoute } from "./routes/patch.route.js";
import { startTelegramBotIfEnabled } from "../telegram/bot.js";
import { registerPolicyGate } from "../apps/http/registerPolicyGate.js";
import {
  guardrails429Total,
  errorsTotal,
  httpLatencyMs,
  promContentType,
  promMetricsText,
  normalizeModelLabel,
  normalizeProviderLabel,
  normalizeCodeLabel,
  normalizeKindLabel,
} from "./prom.js";

type ReqLogCtx = {
  requestId: string;
  startedAt: number;
  path: string;
  method: string;
  model?: string;
};

function safeLog(
  logFn: (obj: any, msg?: string) => void,
  obj: any,
  msg?: string
) {
  try {
    logFn(obj, msg);
  } catch {
    // no-op
  }
}

const app = Fastify({
  logger: {
    transport: process.env.TELEGPT_ENV === "dev"
      ? { target: "pino-pretty" }
      : undefined,
  },
  bodyLimit: Math.max(
    1024,
    Number(process.env.TELEGPT_BODY_LIMIT ?? "1048576") || 1048576
  ),
  trustProxy: process.env.TELEGPT_TRUST_PROXY === "1",
});

void startTelegramBotIfEnabled().catch((err) => {
  app.log.error({ err }, "[telegram] bot start failed");
});

await registerTranslateRoute(app);
await registerModelsRoute(app);
await registerJsonRoute(app);
await registerChatRoute(app);
await registerPolicyGate(app);
await registerAgentRoute(app);
await registerForgeRoute(app);
await registerPatchRoute(app);

const MAX_CONCURRENCY = Math.max(
  1,
  Number(process.env.TELEGPT_MAX_CONCURRENCY ?? "4") || 4
);
const maxQueueParsed = Number(process.env.TELEGPT_MAX_QUEUE);
const MAX_QUEUE = Math.max(0, Number.isFinite(maxQueueParsed) ? maxQueueParsed : 50);
const BUILD_ID = process.env.TELEGPT_BUILD_ID ?? "dev";
const GIT_SHA = process.env.TELEGPT_GIT_SHA ?? "";
const HOST = process.env.TELEGPT_HOST ?? process.env.HOST ?? "0.0.0.0";
const PORT_PARSED = Number(process.env.TELEGPT_PORT ?? process.env.PORT ?? "8787");
const PORT = Number.isFinite(PORT_PARSED) ? PORT_PARSED : 8787;
const REQUEST_TIMEOUT_MS = Math.max(
  1000,
  Number(process.env.TELEGPT_REQUEST_TIMEOUT_MS ?? "180000") || 180000
);
const sem = createSemaphore(MAX_CONCURRENCY);
let isClosing = false;
let activeHttp = 0;
const sockets = new Set<Socket>();

app.server.on("connection", (socket: Socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});

app.addHook("onRequest", async (req, reply) => {
  activeHttp++;
  if (isClosing) reply.header("Connection", "close");
  const headerId = req.headers["x-request-id"];
  const requestId =
    typeof headerId === "string" && headerId.length > 0 ? headerId : randomUUID();
  (req as any).__logCtx = {
    requestId,
    startedAt: Date.now(),
    path: req.url,
    method: req.method,
  } satisfies ReqLogCtx;
  reply.header("x-request-id", requestId);

  safeLog(
    req.log.info.bind(req.log),
    {
      event: "http.request",
      requestId,
      method: req.method,
      path: req.url,
      buildId: BUILD_ID,
      gitSha: GIT_SHA || undefined,
    },
    "http.request"
  );
});
app.addHook("onResponse", async (req, reply) => {
  activeHttp = Math.max(0, activeHttp - 1);
  const ctx = (req as any).__logCtx as ReqLogCtx | undefined;
  const durationMs =
    ctx && typeof ctx.startedAt === "number" ? Date.now() - ctx.startedAt : undefined;
  const latencyMs = durationMs;

  const idem = reply.getHeader("x-idempotency-cache");
  const retryMs = reply.getHeader("x-retry-after-ms");
  const retryAfter = reply.getHeader("retry-after");
  const usedProvider = reply.getHeader("x-used-provider");
  const modelHeader = reply.getHeader("x-model");
  const errorCode = reply.getHeader("x-error-code");
  const errorKind = reply.getHeader("x-error-kind");
  const errorCodeValue =
    typeof errorCode === "string"
      ? errorCode
      : Array.isArray(errorCode)
      ? errorCode[0]
      : undefined;
  const errorKindValue =
    typeof errorKind === "string"
      ? errorKind
      : Array.isArray(errorKind)
      ? errorKind[0]
      : undefined;

  const guardrails = {
    idempotencyCache:
      typeof idem === "string" ? idem : Array.isArray(idem) ? idem[0] : undefined,
    retryAfterMs:
      typeof retryMs === "string"
        ? Number(retryMs)
        : Array.isArray(retryMs)
        ? Number(retryMs[0])
        : typeof retryMs === "number"
        ? retryMs
        : undefined,
    retryAfterSec:
      typeof retryAfter === "string"
        ? Number(retryAfter)
        : Array.isArray(retryAfter)
        ? Number(retryAfter[0])
        : typeof retryAfter === "number"
        ? retryAfter
        : undefined,
  };

  const provider =
    typeof usedProvider === "string"
      ? usedProvider
      : Array.isArray(usedProvider)
      ? usedProvider[0]
      : undefined;
  const model =
    typeof modelHeader === "string"
      ? modelHeader
      : Array.isArray(modelHeader)
      ? modelHeader[0]
      : ctx?.model;

  safeLog(
    req.log.info.bind(req.log),
    {
      event: "http.response",
      requestId: ctx?.requestId,
      method: ctx?.method,
      path: ctx?.path,
      status: reply.statusCode,
      latency_ms: latencyMs,
      model: typeof model === "string" ? model : undefined,
      usedProvider: provider,
      concurrency: sem.stats(),
      error: {
        code: errorCodeValue,
        kind: errorKindValue,
      },
      guardrails: {
        idempotency: guardrails.idempotencyCache,
        retry_after_ms: guardrails.retryAfterMs,
        retry_after_sec: guardrails.retryAfterSec,
        concurrency: {
          inflight: typeof reply.getHeader("x-concurrency-inflight") === "string"
            ? Number(reply.getHeader("x-concurrency-inflight"))
            : undefined,
          queued: typeof reply.getHeader("x-concurrency-queued") === "string"
            ? Number(reply.getHeader("x-concurrency-queued"))
            : undefined,
          max: typeof reply.getHeader("x-concurrency-max") === "string"
            ? Number(reply.getHeader("x-concurrency-max"))
            : undefined,
        },
      },
    },
    "http.response"
  );

  const providerLabel = normalizeProviderLabel(provider);
  const modelLabel = normalizeModelLabel(
    typeof model === "string" ? model : undefined
  );

  const observedMs =
    typeof latencyMs === "number"
      ? latencyMs
      : typeof durationMs === "number"
      ? durationMs
      : undefined;
  if (typeof observedMs === "number") {
    httpLatencyMs
      .labels(providerLabel, modelLabel, String(reply.statusCode))
      .observe(observedMs);
  }

  if (reply.statusCode >= 400) {
    const errorCodeLabel = normalizeCodeLabel(errorCodeValue);
    const errorKindLabel = normalizeKindLabel(errorKindValue);
    errorsTotal.labels(errorCodeLabel, errorKindLabel, providerLabel, modelLabel).inc(1);
  }

  if (reply.statusCode === 429) {
    const reason = normalizeKindLabel(errorKindValue);
    if (reason === "shutdown" || reason === "overloaded") {
      guardrails429Total.labels(reason).inc(1);
    }
  }

  const requestId = ctx?.requestId;
  const ua = req.headers["user-agent"];
  const logRecord = {
    ts: new Date().toISOString(),
    level:
      reply.statusCode >= 500
        ? "error"
        : reply.statusCode >= 400
        ? "warn"
        : "info",
    request_id: requestId,
    method: req.method,
    path: req.url,
    status: reply.statusCode,
    duration_ms: typeof durationMs === "number" ? durationMs : undefined,
    error_code: errorCodeValue,
    provider: typeof usedProvider === "string"
      ? usedProvider
      : Array.isArray(usedProvider)
      ? usedProvider[0]
      : undefined,
    model: ctx?.model,
    ip: req.ip,
    user_agent: typeof ua === "string" ? ua : undefined,
  };
  console.log(JSON.stringify(logRecord));
});

app.addHook("onSend", async (_req, reply, payload) => {
  const ctx = (_req as any).__logCtx;
  const rid =
    ctx?.requestId ||
    (typeof _req.headers["x-request-id"] === "string" && _req.headers["x-request-id"]) ||
    (_req as any).id;

  if (rid) {
    reply.header("x-request-id", rid);
  }
  reply.header("x-build-id", BUILD_ID);
  if (GIT_SHA) reply.header("x-git-sha", GIT_SHA);
  return payload;
});

app.get("/health", (_req, reply) => {
  reply.header("content-type", "application/json");
  if (isClosing) {
    return reply.code(503).send({
      ok: false,
      service: "tele-gpt",
      closing: true,
      env: process.env.TELEGPT_ENV ?? process.env.NODE_ENV ?? "dev",
      uptime_s: Math.round(process.uptime()),
      ts: new Date().toISOString(),
    });
  }
  reply.send({
    ok: true,
    service: "tele-gpt",
    env: process.env.TELEGPT_ENV ?? process.env.NODE_ENV ?? "dev",
    uptime_s: Math.round(process.uptime()),
    ts: new Date().toISOString(),
  });
});

app.get("/v1/models", async (_req, reply) => {
  return reply.send(listModels());
});

app.get("/metrics", async (_req, reply) => {
  const semSt = sem.stats();
  return reply.send({
    ok: true,
    pid: process.pid,
    isClosing,
    uptimeSec: Math.round(process.uptime()),
    version: { buildId: BUILD_ID, gitSha: GIT_SHA },
    limits: { maxConcurrency: MAX_CONCURRENCY, maxQueue: MAX_QUEUE },
    concurrency: semSt,
    idempotency: idempoStats(),
    http: {
      activeHttp,
      sockets: sockets.size,
    },
  });
});

app.get("/metrics.prom", async (_req, reply) => {
  reply.header("content-type", promContentType());
  return reply.send(await promMetricsText());
});

app.get("/ready", (_req, reply) => {
  if (isClosing) {
    return reply.code(503).send({
      ready: false,
      service: "tele-gpt",
      closing: true,
      env: process.env.TELEGPT_ENV ?? process.env.NODE_ENV ?? "dev",
      ts: new Date().toISOString(),
    });
  }
  return reply.send({
    ready: true,
    service: "tele-gpt",
    env: process.env.TELEGPT_ENV ?? process.env.NODE_ENV ?? "dev",
    ts: new Date().toISOString(),
  });
});

app.post("/v1/chat", async (req, reply) => {
  if (isClosing) {
    const st = sem.stats();
    const ctx = (req as any).__logCtx as ReqLogCtx | undefined;
    const requestId = ctx?.requestId ?? randomUUID();
    reply.header("Connection", "close");
    reply.header("Retry-After", "3");
    reply.header("x-retry-after-ms", "3000");
    reply.header("x-error-code", "TELEGPT_SHUTDOWN");
    reply.header("x-error-kind", "shutdown");
    reply.header("x-concurrency-inflight", String(st.inFlight));
    reply.header("x-concurrency-queued", String(st.queued));
    reply.header("x-concurrency-max", String(st.max));
    return reply.code(429).send({
      error: {
        code: "TELEGPT_SHUTDOWN",
        kind: "shutdown",
        message: "Server is restarting, retry later",
        retryable: true,
        requestId,
      },
      request_id: requestId,
    });
  }
  const body = (req.body ?? {}) as ChatRequest;
  const model = typeof body.model === "string" ? body.model : undefined;
  if (model) reply.header("x-model", model);
  const ctx = (req as any).__logCtx as ReqLogCtx | undefined;
  if (ctx && model) ctx.model = model;
  const headerId = req.headers["x-request-id"];
  let requestId =
    ctx?.requestId ||
    (typeof headerId === "string" && headerId) ||
    (req as any).id ||
    randomUUID();
  if (!headerId && typeof body.request_id === "string" && body.request_id) {
    requestId = body.request_id;
    if (ctx) ctx.requestId = requestId;
  }
  const result = await idempoHandle(requestId, async () => {
    const st = sem.stats();
    if (st.inFlight >= st.max && st.queued >= MAX_QUEUE) {
      const retryMs = Math.min(5000, 250 + st.queued * 50);
      reply.header("Connection", "close");
      reply.header("x-retry-after-ms", String(retryMs));
      reply.header("x-error-code", "TELEGPT_OVERLOADED");
      reply.header("x-error-kind", "overloaded");
      reply.header(
        "Retry-After",
        String(Math.max(1, Math.ceil(retryMs / 1000)))
      );
      reply.header("x-concurrency-inflight", String(st.inFlight));
      reply.header("x-concurrency-queued", String(st.queued));
      reply.header("x-concurrency-max", String(st.max));
      return {
        body: {
          error: {
            code: "TELEGPT_OVERLOADED",
            kind: "overloaded",
            message: "Server busy, retry later",
            retryable: true,
            requestId,
          },
          request_id: requestId,
        },
        statusCode: 429,
      };
    }
     const release = await sem.acquire();
     try {
       const res = await (REQUEST_TIMEOUT_MS > 0
         ? Promise.race([
             routeChat({ ...body, request_id: requestId }),
             new Promise<never>((_, reject) => {
               setTimeout(() => {
                 const err = new Error("Upstream timeout");
                 (err as any).name = "AbortError";
                 (err as any).code = "ETIMEDOUT";
                 reject(err);
               }, REQUEST_TIMEOUT_MS);
             }),
           ])
         : routeChat({ ...body, request_id: requestId }));
       return { body: res, statusCode: 200 };
    } catch (e) {
      const code =
        typeof (e as any)?.code === "string" ? (e as any).code : undefined;
      if (code === "NO_PROVIDER_CONFIGURED") {
        const hint =
          typeof (e as any)?.hint === "string" ? (e as any).hint : undefined;
        reply.header("x-error-code", code);
        return {
          body: {
            error: code,
            message: "No LLM provider configured",
            hint:
              hint ??
              "Set OPENAI_API_KEY or LOCAL_OPENAI_BASE_URL + LOCAL_OPENAI_MODEL",
            request_id: requestId,
            ts: new Date().toISOString(),
          },
          statusCode: 503,
        };
      }
      if (code === "PROVIDER_UNAVAILABLE" || code === "PROVIDER_ERROR") {
        const provider =
          typeof (e as any)?.provider === "string" ? (e as any).provider : undefined;
        const message =
          typeof (e as any)?.message === "string" && (e as any).message.length
            ? (e as any).message
            : "Provider unavailable";
        reply.header("x-error-code", code);
        if (provider) reply.header("x-used-provider", provider);
        return {
          body: {
            error: "PROVIDER_UNAVAILABLE",
            provider,
            message,
            request_id: requestId,
            ts: new Date().toISOString(),
          },
          statusCode: 502,
        };
      }
      const providerHint =
        typeof model === "string" && model.startsWith("openai:")
          ? "openai"
          : "local";
      const ne = normalizeError(e, requestId, { provider: providerHint });
      reply.header("x-error-code", ne.code);
      reply.header("x-error-kind", ne.kind);
      if (ne.retryable) {
        reply.header("Retry-After", "1");
        reply.header("x-retry-after-ms", "1000");
      }
      if (ne.provider) reply.header("x-used-provider", ne.provider);
      return {
        body: {
          error: {
            code: ne.code,
            kind: ne.kind,
            message: ne.message,
            retryable: ne.retryable,
            requestId,
            provider: ne.provider,
            provider_error: ne.provider_error,
          },
          request_id: requestId,
        },
        statusCode: ne.status,
      };
    } finally {
      release();
    }
  });
  const usedProvider = (result.body as any)?.meta?.provider;
  if (typeof usedProvider === "string") {
    reply.header("x-used-provider", usedProvider);
  }
  const s = sem.stats();
  reply.header("x-concurrency-inflight", String(s.inFlight));
  reply.header("x-concurrency-queued", String(s.queued));
  reply.header("x-concurrency-max", String(s.max));
  reply.header("x-idempotency-cache", result.usedCache ? "hit" : "miss");
  return reply.code(result.statusCode).send(result.body);
});

app.listen({ port: PORT, host: HOST })
  .then(() => app.log.info(`Tele•GPT listening on :${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });

async function shutdown(signal: string) {
  if (isClosing) return;
  isClosing = true;
  app.log.info(`[shutdown] ${signal}: draining...`);

  try {
    app.server.close();
  } catch {}
  (app.server as any).keepAliveTimeout = 1_000;
  (app.server as any).headersTimeout = 5_000;

  const started = Date.now();
  const TIMEOUT_MS = Math.max(
    1000,
    Number(process.env.TELEGPT_SHUTDOWN_TIMEOUT_MS ?? "15000") || 15000
  );

  while (true) {
    const st = sem.stats();
    if (st.inFlight === 0 && activeHttp === 0) break;
    if (Date.now() - started > TIMEOUT_MS) {
      app.log.warn(
        `[shutdown] timeout; inflight=${st.inFlight} queued=${st.queued}`
      );
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  try {
    await app.close();
  } catch (e) {
    app.log.warn({ err: e }, "[shutdown] fastify.close error");
  } finally {
    for (const s of sockets) {
      try {
        s.destroy();
      } catch {}
    }
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
