import { LocalIntent } from"./localIntentResolver.js";
import { LOCAL_MODELS } from"./localModels.js";

export type FallbackChain = string[];

const INTENT_MODEL_MAP: Record<LocalIntent, FallbackChain> = {
  chat: ["deepseek", "gemma3n"],
  code: ["deepseek", "qwen3:8b", "gemma3n"],
  translation: ["translategemma", "deepseek", "qwen3:8b"],
  summary: ["deepseek", "mistral", "gemma3n"],
  vision: ["minicpm-v", "moondream"],
  reasoning: ["qwen3:8b", "gemma4:12b", "mistral"],
};

export function selectLocalModel(intent: LocalIntent): FallbackChain {
  return INTENT_MODEL_MAP[intent] || INTENT_MODEL_MAP.chat;
}

export function getFirstAvailableModel(
  chain: FallbackChain,
  availableModels: string[]
): string | null {
  for (const modelId of chain) {
    const entry = LOCAL_MODELS[modelId];
    if (!entry) continue;

    const searchKey = entry.model.split(":")[0];
    const found = availableModels.some((m) => m.includes(searchKey));
    if (found) return modelId;
  }
  return null;
}

export function getAllIntents(): LocalIntent[] {
  return Object.keys(INTENT_MODEL_MAP) as LocalIntent[];
}

export function getIntentLabel(intent: LocalIntent): string {
  const labels: Record<LocalIntent, string> = {
    code: "Code / Architecture",
    translation: "Translation",
    summary: "Summary",
    vision: "Vision / Image",
    reasoning: "Reasoning",
    chat: "Chat / General",
  };
  return labels[intent];
}
