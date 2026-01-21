import { llmChatAnswer } from "../chat/llmChat.ts";
import { fail } from "../llm/contract.ts";

export async function registerChatRoute(server: any) {
  server.post("/chat", async (req: any, reply: any) => {
    const body = (req.body ?? {}) as any;

    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.status(400).send(fail("bad_request"));
    }

    try {
      const res = await llmChatAnswer({
        messages,
        model: body.model,
        mode: body.mode ?? "public",
      });

      return reply.send(res);
    } catch (e: any) {
      return reply.status(502).send(fail("llm_failed", { message: e?.message ?? "unknown" }));
    }
  });
}
