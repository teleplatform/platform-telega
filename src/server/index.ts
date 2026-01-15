import "dotenv/config";
import Fastify from "fastify";
import { randomUUID } from "crypto";
import { routeChat } from "../core/router.ts";
import type { ChatRequest } from "../types/chat.ts";
import { listModels } from "../core/models.ts";

const app = Fastify({
  logger: {
    transport: process.env.TELEGPT_ENV === "dev"
      ? { target: "pino-pretty" }
      : undefined,
  },
});

app.get("/health", async () => ({
  ok: true,
  service: "tele-gpt",
  ts: Date.now(),
}));

app.get("/v1/models", async (_req, reply) => {
  return reply.send(listModels());
});

app.post("/v1/chat", async (req, reply) => {
  const body = (req.body ?? {}) as ChatRequest;
  const requestId = (req as any).id ?? randomUUID();
  const res = await routeChat(body, { requestId });
  return reply.send(res);
});

const port = Number(process.env.TELEGPT_PORT ?? 8787);

app.listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`Tele•GPT listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
