import { routeChat } from "../../core/router.js";
import { fail } from "../llm/contract.js";

export async function registerChatRoute(server: any) {
  server.post("/chat", async (req: any, reply: any) => {
    const body = (req.body ?? {}) as any;
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.status(400).send(fail("bad_request"));
    }
    const lastMsg = messages.at(-1);
    const userContent = lastMsg?.content ?? "";
    try {
      const res = await routeChat({
        message: userContent,
        model: body.model || "",
      });
      return reply.send(res);
    } catch (e: any) {
      console.error("[chat] error:", e?.message);
      return reply.status(502).send(fail("llm_failed", { message: e?.message ?? "unknown" }));
    }
  });
}
