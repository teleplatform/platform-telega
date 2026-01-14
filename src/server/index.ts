import "dotenv/config";
import Fastify from "fastify";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true, service: "tele-gpt", ts: Date.now() }));

app.post("/v1/chat", async (req, reply) => {
  // пока заглушка: просто эхо
  const body = (req.body ?? {}) as any;
  const message = body?.message ?? "";
  return reply.send({
    id: "demo",
    model: body?.model ?? "local-demo",
    output: `Tele•GPT says: ${message}`,
  });
});

const port = Number(process.env.TELEGPT_PORT ?? 8787);

app.listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`Tele•GPT listening on :${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
