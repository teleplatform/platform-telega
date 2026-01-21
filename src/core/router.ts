import type { ChatRequest, ChatResponse } from "../types/chat.ts";
import { localDemo } from "../providers/local/demo.ts";
import { chat as localChat } from "../providers/local/chat.ts";
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

function stripPrefix(model: string, prefix: "openai:" | "local:") {
  return model.startsWith(prefix) ? model.slice(prefix.length) : model;
}

export async function routeChat(req: ChatRequest): Promise<ChatResponse> {
  const t0 = Date.now();
  const model = (req.model || "local:local-demo").trim();
  const request_id = makeRequestId(req);

  let base: ChatResponse;
  let provider: "local" | "openai";
  let resolved_model: string;

  if (model.startsWith("openai:")) {
    provider = "openai";
    resolved_model = stripPrefix(model, "openai:");
    base = await openaiChat({ ...req, model: resolved_model });
  } else if (model.startsWith("local:")) {
    provider = "local";
    resolved_model = stripPrefix(model, "local:");

    if (resolved_model === "local-demo") {
      base = await localDemo({ ...req, model: "local-demo" });
    } else {
      base = await localChat({ ...req, model: resolved_model });
    }
  } else {
    provider = "local";
    resolved_model = "local-demo";
    base = await localDemo({ ...req, model: "local-demo" });
  }

  const usage =
    base.meta?.usage ??
    (base.usage
      ? {
          tokens_in: base.usage.inputTokens,
          tokens_out: base.usage.outputTokens,
        }
      : undefined);

  return {
    ...base,
    request_id,
    latency_ms: Date.now() - t0,
    meta: {
      ...(base.meta || {}),
      provider,
      model: resolved_model,
      usage,
    },
  };
}
