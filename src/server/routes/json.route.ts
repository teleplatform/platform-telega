import { ok, fail } from "../llm/contract.ts";
import { llmGenerateStrictJSON } from "../json/llmJson.ts";

export async function registerJsonRoute(server: any) {
  server.post("/json", async (req: any, reply: any) => {
    const body = (req.body ?? {}) as any;

    const prompt = body.prompt;
    if (!prompt || typeof prompt !== "string") {
      return reply.status(400).send(fail("bad_request"));
    }

    const mode = (body.mode ?? "public") as "public" | "maker";
    const model = typeof body.model === "string" ? body.model : undefined;
    const schemaHint = typeof body.schemaHint === "string" ? body.schemaHint : undefined;

    const jsonMode = body.jsonMode === "repair" ? "repair" : "strict";

    const res = await llmGenerateStrictJSON({
      prompt,
      schemaHint,
      mode,
      model,
      jsonMode,
    });

    const status = res.ok ? 200 : res.error === "limit" ? 413 : 502;
    return reply.status(status).send(res);
  });
}
