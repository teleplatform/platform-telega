type Lane = "cheap" | "smart" | "coding";
type ProviderName = "local" | "openai" | "anthropic" | "xai" | "openrouter" | "dashscope" | "glm";

export function resolveProviderForLane(lane: Lane): ProviderName {
  const def = process.env.TELEGPT_PROVIDER_DEFAULT?.toLowerCase();
  if (def === "local") return "local";

  return "local";
}

export function resolveModelForProvider(provider: ProviderName, lane: Lane): string {
  if (provider === "local") {
    return process.env.LOCAL_OPENAI_MODEL_DEFAULT || "qwen2.5:7b-instruct";
  }

  return "unknown";
}
