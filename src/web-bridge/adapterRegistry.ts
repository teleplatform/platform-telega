import type { WebProvider, WebProviderAdapter } from "./types";
import { ChatGPTAdapter } from "./adapters/chatgpt.adapter";
import { DeepSeekAdapter } from "./adapters/deepseek.adapter";
import { QwenAdapter } from "./adapters/qwen.adapter";

const REGISTRY: Record<WebProvider, WebProviderAdapter> = {
  chatgpt_web: ChatGPTAdapter,
  deepseek_web: DeepSeekAdapter,
  qwen_web: QwenAdapter,
};

export function getAdapter(id: WebProviderAdapter["id"]) {
  return REGISTRY[id];
}

export function listAdapters() {
  return Object.values(REGISTRY);
}
