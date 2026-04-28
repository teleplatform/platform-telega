import { hasDashScopeKey, dashScopeQwenChat } from "./dashscopeQwen.ts";
import { openRouterChat } from "./openrouterChat.ts";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function has(v?: string) {
  return typeof v === "string" && v.trim().length > 0;
}

export async function qwenChat(opts: {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  dashscope_model?: string;
  openrouter_model?: string;
}): Promise<{
  output: string;
  provider_used: "dashscope" | "openrouter";
  model_used: string;
  fallback_used: boolean;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}> {
  const dashscopeModel = opts.dashscope_model || process.env.QWEN_MODEL_DEFAULT || "qwen-plus-latest";
  const openrouterModel =
    opts.openrouter_model || process.env.OPENROUTER_QWEN_MODEL || "qwen/qwen-2.5-72b-instruct";

  if (hasDashScopeKey()) {
    const r = await dashScopeQwenChat({
      model: dashscopeModel,
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
    });

    return {
      output: r.output,
      provider_used: "dashscope",
      model_used: dashscopeModel,
      fallback_used: false,
      usage: r.usage,
    };
  }

  if (has(process.env.OPENROUTER_API_KEY)) {
    const r = await openRouterChat({
      model: openrouterModel,
      messages: opts.messages,
      temperature: opts.temperature,
      max_tokens: opts.max_tokens,
    });

    return {
      output: r.output,
      provider_used: "openrouter",
      model_used: openrouterModel,
      fallback_used: true,
      usage: r.usage,
    };
  }

  throw new Error("qwen_not_configured: set DASHSCOPE_API_KEY or OPENROUTER_API_KEY");
}
