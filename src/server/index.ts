import "dotenv/config";
import Fastify from "fastify";
import { routeChat } from "../core/router.js";
import type { ChatRequest } from "../types/chat.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "tele-gpt", ts: Date.now() }));

app.post("/v1/chat", async (req, reply) => {
  const body = (req.body ?? {}) as ChatRequest;
  const res = await routeChat(body);
  return reply.send(res);
});

const port = Number(process.env.TELEGPT_PORT ?? 8787);

app.listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`Tele•GPT listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
