import Fastify from "fastify";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

type AskRequest = {
  message: string;
  user_id?: string;
};

type AskResponse = {
  trace_id: string;
  reply: string;
  mode: "echo" | "openai";
};

function traceId() {
  return crypto.randomBytes(12).toString("hex");
}

export async function buildServer() {
  const app = Fastify({ logger: true });

  app.get("/health", async () => {
    return { ok: true };
  });

  app.post<{ Body: AskRequest }>("/v1/ask", async (req, reply) => {
    const t = traceId();
    const msg = (req.body?.message ?? "").trim();

    if (!msg) {
      return reply.status(400).send({
        trace_id: t,
        error: "message is required",
      });
    }

    let mode: AskResponse["mode"] = "echo";
    let out = `echo: ${msg}`;

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (apiKey) {
      mode = "openai";
      out = `openai: ${msg}`;
    }

    const res: AskResponse = {
      trace_id: t,
      reply: out,
      mode,
    };

    return res;
  });

  return app;
}

async function main() {
  const app = await buildServer();
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || "0.0.0.0";

  await app.listen({ port, host });
  app.log.info({ port, host }, "P1 MVP server started");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
