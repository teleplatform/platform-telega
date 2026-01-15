import type { ChatRequest, ChatResponse } from "../../types/chat.js";

export async function localDemo(req: ChatRequest): Promise<ChatResponse> {
  const msg = req.message ?? "";
  return {
    id: "local-demo",
    model: req.model ?? "local-demo",
    output: `Tele•GPT говорит: ${msg}`,
  };
}
