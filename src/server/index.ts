import "dotenv/config";
import Fastify from "fastify";
import { randomUUID } from "crypto";
import type { Socket } from "node:net";
import { routeChat } from "../core/router.ts";
import type { ChatRequest, ChatResponse } from "../types/chat.ts";
import { listModels } from "../core/models.ts";
import { idempoHandle, idempoStats } from "./idempotency.ts";
import { createSemaphore } from "./semaphore.ts";

const app = Fastify({
  logger: {
    transport: process.env.TELEGPT_ENV === "dev"
      ? { target: "pino-pretty" }
      : undefined,
  },
});

const MAX_CONCURRENCY = Math.max(
  1,
  Number(process.env.TELEGPT_MAX_CONCURRENCY ?? "4") || 4
);
const maxQueueParsed = Number(process.env.TELEGPT_MAX_QUEUE);
const MAX_QUEUE = Math.max(0, Number.isFinite(maxQueueParsed) ? maxQueueParsed : 50);
const BUILD_ID = process.env.TELEGPT_BUILD_ID ?? "dev";
const GIT_SHA = process.env.TELEGPT_GIT_SHA ?? "";
const sem = createSemaphore(MAX_CONCURRENCY);
let isClosing = false;
let activeHttp = 0;
const sockets = new Set<Socket>();

app.server.on("connection", (socket: Socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});

app.addHook("onRequest", async (_req, reply) => {
  activeHttp++;
  if (isClosing) reply.header("Connection", "close");
});
app.addHook("onResponse", async () => {
  activeHttp = Math.max(0, activeHttp - 1);
});

app.addHook("onSend", async (_req, reply, payload) => {
  reply.header("x-build-id", BUILD_ID);
  if (GIT_SHA) reply.header("x-git-sha", GIT_SHA);
  return payload;
});

app.get("/health", async (_req, reply) => {
  if (isClosing) {
    return reply.code(503).send({
      ok: false,
      closing: true,
      version: { buildId: BUILD_ID, gitSha: GIT_SHA },
    });
  }
  return reply.send({
    ok: true,
    service: "tele-gpt",
    ts: Date.now(),
    version: { buildId: BUILD_ID, gitSha: GIT_SHA },
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

app.get("/ready", async (_req, reply) => {
  if (isClosing) {
    reply.header("Connection", "close");
    return reply.code(503).send({
      ok: false,
      ready: false,
      closing: true,
      version: { buildId: BUILD_ID, gitSha: GIT_SHA },
    });
  }
  const st = sem.stats();
  return reply.send({
    ok: true,
    ready: true,
    version: { buildId: BUILD_ID, gitSha: GIT_SHA },
    concurrency: st,
  });
});

app.post("/v1/chat", async (req, reply) => {
  if (isClosing) {
    const st = sem.stats();
    reply.header("Connection", "close");
    reply.header("Retry-After", "3");
    reply.header("x-retry-after-ms", "3000");
    reply.header("x-concurrency-inflight", String(st.inFlight));
    reply.header("x-concurrency-queued", String(st.queued));
    reply.header("x-concurrency-max", String(st.max));
    return reply.code(429).send({ error: "Server is restarting, retry later" });
  }
  const body = (req.body ?? {}) as ChatRequest;
  const headerId = req.headers["x-request-id"];
  const requestId =
    (typeof headerId === "string" && headerId) ||
    (req as any).id ||
    randomUUID();
  const result = await idempoHandle(requestId, async () => {
    const st = sem.stats();
    if (st.inFlight >= st.max && st.queued >= MAX_QUEUE) {
      const retryMs = Math.min(5000, 250 + st.queued * 50);
      reply.header("x-retry-after-ms", String(retryMs));
      reply.header(
        "Retry-After",
        String(Math.max(1, Math.ceil(retryMs / 1000)))
      );
      reply.header("x-concurrency-inflight", String(st.inFlight));
      reply.header("x-concurrency-queued", String(st.queued));
      reply.header("x-concurrency-max", String(st.max));
      return reply.code(429).send({ error: "Server busy, retry later" });
    }
    const release = await sem.acquire();
    try {
      const res = await routeChat(body, { requestId });
      return { body: res, statusCode: 200 };
    } finally {
      release();
    }
  });
  const s = sem.stats();
  reply.header("x-concurrency-inflight", String(s.inFlight));
  reply.header("x-concurrency-queued", String(s.queued));
  reply.header("x-concurrency-max", String(s.max));
  reply.header("x-idempotency-cache", result.usedCache ? "hit" : "miss");
  return reply.code(result.statusCode).send(result.body);
});

const port = Number(process.env.TELEGPT_PORT ?? 8787);

app.listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`Tele•GPT listening on :${port}`))
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
    app.log.warn("[shutdown] fastify.close error:", e);
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
