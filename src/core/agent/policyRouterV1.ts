import type { Intent } from "./intentRouterV1";

export type Lane = "cheap" | "smart" | "coding";
export type PolicyResult = {
  lane: Lane;
  max_tokens: number;
  timeout_ms: number;
  fallback_chain: Array<{ provider: string; model?: string }>;
};

export function policyForIntentV1(intent: Intent): PolicyResult {
  if (intent === "inquiry" || intent === "delivery") {
    return {
      lane: "cheap",
      max_tokens: 350,
      timeout_ms: 7000,
      fallback_chain: [{ provider: "local" }, { provider: "openrouter" }],
    };
  }

  if (intent === "buy" || intent === "booking" || intent === "warranty") {
    return {
      lane: "smart",
      max_tokens: 650,
      timeout_ms: 12000,
      fallback_chain: [{ provider: "local" }, { provider: "openai" }],
    };
  }

  return {
    lane: "smart",
    max_tokens: 500,
    timeout_ms: 9000,
    fallback_chain: [{ provider: "local" }],
  };
}
