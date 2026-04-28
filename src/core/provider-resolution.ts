export type RuntimeRole = "creator" | "user";
export type ExecutionPath = "bridge" | "api";
export type UserIntentPreference = "fast" | "quality" | "cheap" | "local_only" | "no_fallback";

export type ProviderId =
  | "openai_web"
  | "chatgpt_web"
  | "qwen_web"
  | "deepseek_web"
  | "grok_web"
  | "kimi_web"
  | "perplexity_web"
  | "claude_web"
  | "openai_api"
  | "qwen_api"
  | "deepseek_api"
  | "local";

export function isBridgeProvider(id: ProviderId): boolean {
  return id.endsWith("_web");
}

export function isApiProvider(id: ProviderId): boolean {
  return id.endsWith("_api");
}

export function normalizeLegacyProviderId(id: string): ProviderId {
  const mapping: Record<string, ProviderId> = {
    openai: "openai_api",
    qwen: "qwen_api",
    deepseek: "deepseek_api",
    openai_web: "openai_web",
    creator: "openai_api",
  };
  return mapping[id] || (id as ProviderId);
}

export type ResolvedProviderConfig = {
  provider: ProviderId;
  model: string;
  fallbackTo: ProviderId[];
  baseURL?: string;
  apiKeyEnv?: string;
  role: RuntimeRole;
  source: "explicit" | "default" | "fallback";
  rawInput: string;
};

type ProviderRegistryEntry = {
  prefix: string;
  provider: ProviderId;
  defaultModel: string;
  role: RuntimeRole;
  resolve: (rawModel: string) => Omit<ResolvedProviderConfig, "source" | "rawInput">;
};

const PROVIDER_REGISTRY: Record<string, ProviderRegistryEntry> = {
  openai_api: {
    prefix: "openai",
    provider: "openai_api",
    defaultModel: "gpt-4o-mini",
    role: "user",
    resolve: (rawModel) => ({
      provider: "openai_api",
      model: rawModel || "gpt-4o-mini",
      fallbackTo: ["local"],
      apiKeyEnv: "OPENAI_API_KEY",
      role: "user",
    }),
  },
  qwen_api: {
    prefix: "qwen",
    provider: "qwen_api",
    defaultModel: "qwen-plus",
    role: "user",
    resolve: (rawModel) => ({
      provider: "qwen_api",
      model: rawModel || "qwen-plus",
      fallbackTo: ["local"],
      apiKeyEnv: "QWEN_API_KEY",
      role: "user",
    }),
  },
  deepseek_api: {
    prefix: "deepseek",
    provider: "deepseek_api",
    defaultModel: process.env.DEEPSEEK_MODEL_DEFAULT || "deepseek-v4-flash",
    role: "user",
    resolve: (rawModel) => ({
      provider: "deepseek_api",
      model: rawModel || process.env.DEEPSEEK_MODEL_DEFAULT || "deepseek-v4-flash",
      fallbackTo: ["local"],
      apiKeyEnv: "DEEPSEEK_API_KEY",
      role: "user",
    }),
  },
  local: {
    prefix: "local",
    provider: "local",
    defaultModel: "local-demo",
    role: "user",
    resolve: (rawModel) => ({
      provider: "local",
      model: rawModel || "local-demo",
      fallbackTo: [],
      role: "user",
    }),
  },
  chatgpt_web: {
    prefix: "chatgpt",
    provider: "chatgpt_web",
    defaultModel: "gpt-4o",
    role: "creator",
    resolve: (rawModel) => ({
      provider: "chatgpt_web",
      model: rawModel || "gpt-4o",
      fallbackTo: ["qwen_web", "deepseek_web", "openai_api", "local"],
      role: "creator",
    }),
  },
  openai_web: {
    prefix: "openai_web",
    provider: "openai_web",
    defaultModel: "gpt-4o-mini",
    role: "creator",
    resolve: (rawModel) => ({
      provider: "openai_web",
      model: rawModel || "gpt-4o-mini",
      fallbackTo: [],
      role: "creator",
    }),
  },
  qwen_web: {
    prefix: "qwen_web",
    provider: "qwen_web",
    defaultModel: "qwen-plus",
    role: "creator",
    resolve: (rawModel) => ({
      provider: "qwen_web",
      model: rawModel || "qwen-plus",
      fallbackTo: ["deepseek_web", "qwen_api", "local"],
      role: "creator",
    }),
  },
  deepseek_web: {
    prefix: "deepseek_web",
    provider: "deepseek_web",
    defaultModel: process.env.DEEPSEEK_MODEL_DEFAULT || "deepseek-v4-flash",
    role: "creator",
    resolve: (rawModel) => ({
      provider: "deepseek_web",
      model: rawModel || process.env.DEEPSEEK_MODEL_DEFAULT || "deepseek-v4-flash",
      fallbackTo: ["deepseek_api", "local"],
      role: "creator",
    }),
  },
  kimi_web: {
    prefix: "kimi_web",
    provider: "kimi_web",
    defaultModel: "kimi-k2.5",
    role: "creator",
    resolve: (rawModel) => ({
      provider: "kimi_web",
      model: rawModel || "kimi-k2.5",
      fallbackTo: [],
      role: "creator",
    }),
  },
};

export function resolveModel(input?: string, role?: RuntimeRole): ResolvedProviderConfig {
  const rawInput = (input ?? "").trim();
  const effectiveRole: RuntimeRole = role || "user";

  if (!rawInput) {
    if (effectiveRole === "creator") {
      return {
        provider: "chatgpt_web",
        model: "gpt-4o",
        fallbackTo: ["qwen_web", "deepseek_web", "openai_api", "local"],
        role: "creator",
        source: "default",
        rawInput,
      };
    }
    return {
      provider: "local",
      model: "local-demo",
      fallbackTo: [],
      role: "user",
      source: "default",
      rawInput,
    };
  }

  const firstColon = rawInput.indexOf(":");
  const prefix = firstColon === -1 
    ? rawInput.toLowerCase()
    : rawInput.slice(0, firstColon).trim().toLowerCase();
  const rest = firstColon === -1 ? "" : rawInput.slice(firstColon + 1).trim();

  const normalizedPrefix = prefix === "openai" ? "openai_api" 
    : prefix === "qwen" ? "qwen_api"
    : prefix === "deepseek" ? "deepseek_api"
    : prefix === "chatgpt" ? "chatgpt_web"
    : prefix;

  const entry = PROVIDER_REGISTRY[normalizedPrefix];

  if (!entry) {
    return {
      provider: "local",
      model: rawInput,
      fallbackTo: [],
      role: "user",
      source: "default",
      rawInput,
    };
  }

  const resolved = entry.resolve(rest);

  return {
    ...resolved,
    role: effectiveRole,
    source: "explicit",
    rawInput,
  };
}
