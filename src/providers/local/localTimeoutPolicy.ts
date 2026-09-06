export type LocalTimeoutIntent =
  | "fast_reply" | "chat" | "code" | "reasoning"
  | "translation" | "summary" | "vision";

export const LOCAL_TIMEOUT_POLICY: Record<string, number> = {
  fast_reply: 15_000,
  chat: 30_000,
  code: 60_000,
  reasoning: 90_000,
  translation: 45_000,
  summary: 45_000,
  vision: 90_000,
  gemma4_12b: 120_000,
  default: 30_000,
};

export function getTimeoutForModel(modelId: string, intent?: string): number {
  if (modelId.includes("gemma4")) return LOCAL_TIMEOUT_POLICY.gemma4_12b;
  if (intent && LOCAL_TIMEOUT_POLICY[intent]) return LOCAL_TIMEOUT_POLICY[intent];
  return LOCAL_TIMEOUT_POLICY.default;
}
