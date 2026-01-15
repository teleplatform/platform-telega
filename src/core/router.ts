import type { ChatRequest, ChatResponse } from "../types/chat.ts";
import { localDemo } from "../providers/local/demo.ts";

export async function routeChat(req: ChatRequest): Promise<ChatResponse> {
  const model = (req.model ?? "local-demo").toLowerCase();

  // Пока только local-demo. OpenAI подключим следующим файлом.
  if (model === "local-demo" || model.startsWith("local:")) {
    return localDemo({ ...req, model: req.model ?? "local-demo" });
  }

  // fallback
  return localDemo({ ...req, model: req.model ?? "local-demo" });
}
