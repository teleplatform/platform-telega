export type LocalTransport = "ollama" | "lmstudio";
export type LocalModelCapability = "chat" | "code" | "reasoning" | "fast_reply" | "offline" | "vision" | "image_understanding" | "image_captioning" | "translation" | "text" | "summary";
export type LocalModelMode = "creator" | "public";

export interface LocalModelEntry {
  id: string;
  name: string;
  transport: LocalTransport;
  model: string;
  capabilities: LocalModelCapability[];
  defaultMode: LocalModelMode;
  warning?: string;
}

export const LOCAL_MODELS: Record<string, LocalModelEntry> = {
  "qwen3:8b": {
    id: "local:qwen3:8b",
    name: "Qwen3 8B",
    transport: "ollama",
    model: "qwen3:8b",
    capabilities: ["chat", "code", "reasoning"],
    defaultMode: "creator",
  },
  "gemma3n": {
    id: "local:gemma3n",
    name: "Gemma 3n",
    transport: "ollama",
    model: "gemma3n:latest",
    capabilities: ["chat", "fast_reply", "offline"],
    defaultMode: "public",
  },
  "gemma4:12b": {
    id: "local:gemma4:12b",
    name: "Gemma 4 12B",
    transport: "ollama",
    model: "gemma4:12b",
    capabilities: ["chat", "reasoning"],
    defaultMode: "creator",
    warning: "slow_on_8gb_ram",
  },
  "deepseek": {
    id: "local:deepseek",
    name: "DeepSeek Local",
    transport: "ollama",
    model: "deepseek-coder:1.3b",
    capabilities: ["code", "chat"],
    defaultMode: "creator",
  },
  "mistral": {
    id: "local:mistral",
    name: "Mistral Local",
    transport: "ollama",
    model: "mistral:7b",
    capabilities: ["chat", "summary"],
    defaultMode: "creator",
  },
  "minicpm-v": {
    id: "local:minicpm-v",
    name: "MiniCPM-V",
    transport: "ollama",
    model: "minicpm-v",
    capabilities: ["vision", "image_understanding"],
    defaultMode: "creator",
  },
  "moondream": {
    id: "local:moondream",
    name: "Moondream",
    transport: "ollama",
    model: "moondream",
    capabilities: ["vision", "image_captioning"],
    defaultMode: "creator",
  },
  "translategemma": {
    id: "local:translategemma",
    name: "TranslateGemma",
    transport: "lmstudio",
    model: "translategemma-12b-it",
    capabilities: ["translation", "text"],
    defaultMode: "creator",
  },
};

export function getLocalModelIds(): string[] {
  return Object.keys(LOCAL_MODELS);
}

export function getLocalModelByCapability(capability: LocalModelCapability): LocalModelEntry[] {
  return Object.values(LOCAL_MODELS).filter((m) => m.capabilities.includes(capability));
}

export function getLocalModel(id: string): LocalModelEntry | undefined {
  return LOCAL_MODELS[id];
}
