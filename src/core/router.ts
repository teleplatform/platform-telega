import type { ChatRequest, ChatResponse } from "../types/chat.ts";
import { localDemo } from "../providers/local/demo.ts";
import { openaiChat } from "../providers/openai/chat.ts";

export async function routeChat(req: ChatRequest): Promise<ChatResponse> {
  const modelRaw = req.model ?? "local-demo";
  const model = modelRaw.toLowerCase();

  if (model === "local-demo" || model.startsWith("local:")) {
    return localDemo({ ...req, model: req.model ?? "local-demo" });
  }

  if (model.startsWith("openai:")) {
    return openaiChat(req);
  }

  return localDemo({ ...req, model: req.model ?? "local-demo" });
}
