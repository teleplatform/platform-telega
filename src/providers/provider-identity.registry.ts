export interface ProviderIdentity {
  id: string;
  publicName: string;
  aliases: string[];
  leakPatterns: RegExp[];
  apiProviderId?: string;
  webProviderId?: string;
  localWebApiProviderId?: string;
}

const PROVIDER_REGISTRY: ProviderIdentity[] = [
  {
    id: "openai",
    publicName: "OpenAI",
    aliases: ["openai", "chatgpt", "gpt", "chat gpt"],
    leakPatterns: [/chatgpt/i, /openai/i, /gpt-?4/i, /gpt-?4o/i, /gpt-?4\.1/i],
    apiProviderId: "openai:api",
    webProviderId: "openai:web",
  },
  {
    id: "deepseek",
    publicName: "DeepSeek",
    aliases: ["deepseek", "дипсик", "深度求索", "deepseek-v3", "deepseek-r1", "deepseek-chat"],
    leakPatterns: [/deepseek/i, /深度求索/i, /deepseek-?(v\d|r\d|chat)/i],
    apiProviderId: "deepseek:api",
    webProviderId: "deepseek:web",
  },
  {
    id: "gemini",
    publicName: "Gemini",
    aliases: ["gemini", "google gemini", "bard"],
    leakPatterns: [/gemini/i],
    apiProviderId: "gemini:api",
    webProviderId: "gemini:web",
  },
  {
    id: "qwen",
    publicName: "Qwen",
    aliases: ["qwen", "алибаба"],
    leakPatterns: [/qwen/i, /алибаба/i],
    apiProviderId: "qwen:api",
    webProviderId: "qwen:web",
  },
  {
    id: "kimi",
    publicName: "Kimi",
    aliases: ["kimi", "moonshot", "kimi-k3"],
    leakPatterns: [/kimi/i, /moonshot/i, /kimi.?k3/i],
    apiProviderId: "kimi:api",
    webProviderId: "kimi:web",
    localWebApiProviderId: "kimi_local_web_api",
  },
  {
    id: "claude",
    publicName: "Claude",
    aliases: ["claude", "anthropic"],
    leakPatterns: [/claude/i, /anthropic/i],
    apiProviderId: "claude:api",
    webProviderId: "claude:web",
  },
  {
    id: "glm",
    publicName: "GLM",
    aliases: ["glm", "zhipu", "чатглм"],
    leakPatterns: [/glm/i, /zhipu/i, /чатглм/i],
    apiProviderId: "glm:api",
    webProviderId: "glm:web",
    localWebApiProviderId: "glm_local_web_api",
  },
  {
    id: "mimo",
    publicName: "Mimo",
    aliases: ["mimo", "xiaomi", "mimocode"],
    leakPatterns: [/mimo/i, /xiaomi/i, /mimocode/i],
    apiProviderId: "mimo:api",
    webProviderId: "mimo_browser_discovery",
  },
];

export function getProviderById(id: string): ProviderIdentity | undefined {
  return PROVIDER_REGISTRY.find(p => p.id === id);
}

export function detectProviderMention(text: string): ProviderIdentity | null {
  for (const provider of PROVIDER_REGISTRY) {
    for (const alias of provider.aliases) {
      const pattern = new RegExp(`ты\\s+${escapeRegex(alias)}|${escapeRegex(alias)}\\s+ли\\s+ты|are\\s+you\\s+${escapeRegex(alias)}`, "i");
      if (pattern.test(text)) return provider;
    }
  }
  return null;
}

export function detectProviderLeak(text: string): ProviderIdentity | null {
  for (const provider of PROVIDER_REGISTRY) {
    for (const pattern of provider.leakPatterns) {
      if (pattern.test(text)) return provider;
    }
  }
  return null;
}

export function getAllProviderLeakPatterns(): RegExp[] {
  const techPatterns = [
    /transformer/i,
    /rlhf/i,
    /671b/i,
    /671\s*B/i,
    /параметров/i,
    /параметрами/i,
  ];
  const providerPatterns = PROVIDER_REGISTRY.flatMap(p => p.leakPatterns);
  return [...providerPatterns, ...techPatterns];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
