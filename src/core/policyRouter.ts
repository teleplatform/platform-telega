import type { Intent, IntentType } from "../types/agent.ts";

export type Lane = "cheap" | "smart" | "coding";

export type LaneConfig = {
  max_tokens: number;
  timeout_ms: number;
};

export type ProviderSpec = {
  provider: "local" | "openai";
  model: string;
};

const LANE_CONFIGS: Record<Lane, LaneConfig> = {
  cheap: { max_tokens: 256, timeout_ms: 6000 },
  smart: { max_tokens: 768, timeout_ms: 15000 },
  coding: { max_tokens: 1200, timeout_ms: 25000 },
};

const CHEAP_INTENTS: Set<IntentType> = new Set([
  "booking",
  "delivery",
  "inquiry",
  "general",
]);

const CODING_KEYWORDS = [
  "typescript",
  "javascript",
  "error:",
  "stacktrace",
  "build failed",
  "syntax error",
  "import",
  "function",
  "const ",
  "let ",
  "```",
  ".ts",
  ".js",
  ".sql",
  "debug",
  "fix this code",
];

export type LaneResult = {
  lane: Lane;
  source: "override" | "default";
};

export function pickLane(
  intent: Intent,
  message: string,
  overrides?: Record<string, Lane>
): LaneResult {
  // Check for policy overrides first
  if (overrides && intent.type in overrides) {
    return { lane: overrides[intent.type], source: "override" };
  }

  const lower = message.toLowerCase();

  // Check for coding indicators
  for (const keyword of CODING_KEYWORDS) {
    if (lower.includes(keyword.toLowerCase())) {
      return { lane: "coding", source: "default" };
    }
  }

  // Check intent type
  if (CHEAP_INTENTS.has(intent.type)) {
    return { lane: "cheap", source: "default" };
  }

  // Complex questions go to smart lane
  const complexIndicators = [
    "why",
    "explain",
    "compare",
    "difference",
    "better",
    "recommend",
    "should i",
    "which one",
  ];
  for (const indicator of complexIndicators) {
    if (lower.includes(indicator)) {
      return { lane: "smart", source: "default" };
    }
  }

  // Long messages likely need smart processing
  if (message.length > 200) {
    return { lane: "smart", source: "default" };
  }

  // Buy/warranty intents that aren't simple FAQs
  if (intent.type === "buy" || intent.type === "warranty" || intent.type === "complaint") {
    return { lane: "smart", source: "default" };
  }

  return { lane: "cheap", source: "default" };
}

export function getLaneConfig(lane: Lane): LaneConfig {
  return LANE_CONFIGS[lane];
}

type EnvModels = {
  has_openai_key: boolean;
  has_local_base_url: boolean;
  cheap_model?: string;
  smart_model?: string;
  coding_model?: string;
  local_default_model?: string;
};

export function buildProviderChain(lane: Lane, env: EnvModels): ProviderSpec[] {
  const chain: ProviderSpec[] = [];

  switch (lane) {
    case "cheap":
      // cheap: local → openai-mini → local-demo
      if (env.has_local_base_url && env.local_default_model) {
        chain.push({
          provider: "local",
          model: env.cheap_model || env.local_default_model,
        });
      }
      if (env.has_openai_key) {
        chain.push({
          provider: "openai",
          model: env.cheap_model || "gpt-4o-mini",
        });
      }
      chain.push({ provider: "local", model: "local-demo" });
      break;

    case "smart":
      // smart: openai-mini → local → openai-better → local-demo
      if (env.has_openai_key) {
        chain.push({
          provider: "openai",
          model: env.smart_model || "gpt-4o-mini",
        });
      }
      if (env.has_local_base_url && env.local_default_model) {
        chain.push({
          provider: "local",
          model: env.smart_model || env.local_default_model,
        });
      }
      chain.push({ provider: "local", model: "local-demo" });
      break;

    case "coding":
      // coding: openai-coding → local → openai-mini → local-demo
      if (env.has_openai_key && env.coding_model) {
        chain.push({ provider: "openai", model: env.coding_model });
      }
      if (env.has_local_base_url && env.local_default_model) {
        chain.push({ provider: "local", model: env.local_default_model });
      }
      if (env.has_openai_key) {
        chain.push({ provider: "openai", model: "gpt-4o-mini" });
      }
      chain.push({ provider: "local", model: "local-demo" });
      break;
  }

  return chain;
}
