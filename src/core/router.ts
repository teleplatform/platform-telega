import type { ChatRequest, ChatResponse } from "../types/chat.ts";
import { localDemo } from "../providers/local/demo.ts";
import { openaiChat } from "../providers/openai/chat.ts";

function makeRequestId(req: ChatRequest): string {
  const anyReq = req as any;
  return (
    (req as any).request_id ||
    anyReq.requestId ||
    anyReq.id ||
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

export async function routeChat(req: ChatRequest): Promise<ChatResponse> {
  const modelRaw = req.model ?? "local-demo";
  const model = modelRaw.toLowerCase();
  const request_id = makeRequestId(req);

  let provider: "local" | "openai" = "local";
  let resolved_model = modelRaw;

  let base: ChatResponse;

  if (model === "local-demo" || model.startsWith("local:")) {
    provider = "local";
    resolved_model = req.model ?? "local-demo";
    base = await localDemo({ ...req, model: resolved_model });
  } else if (model.startsWith("openai:")) {
    provider = "openai";
    resolved_model = modelRaw;
    base = await openaiChat(req);
  } else {
    provider = "local";
    resolved_model = req.model ?? "local-demo";
    base = await localDemo({ ...req, model: resolved_model });
  }

  return {
    ...base,
    meta: {
      request_id,
      provider,
      model_raw: modelRaw,
      model_resolved: resolved_model,
      ts: Date.now(),
    },
  } as ChatResponse;
}

