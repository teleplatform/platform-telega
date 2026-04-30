import { BridgeSelectors } from "./response-extractor";
import { ProviderKind, ProviderProfile, ProviderProfileRegistry, RuntimeRole } from "./chat-types";

/**
 * Контракт адаптера провайдера (PHASE 2)
 */
export interface ProviderAdapter {
  id: string;
  name: string;
  type: "bridge" | "api";
  baseUrl: string;
  selectors?: BridgeSelectors;
  getNewChatUrl?: () => string;
}

/**
 * Статические адаптеры провайдеров
 */
export const PROVIDERS: Record<string, ProviderAdapter> = {
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    type: "bridge",
    baseUrl: "https://chatgpt.com",
    selectors: {
      assistantMessage: 'div[data-message-author-role="assistant"]',
      streamingIndicator: ".result-streaming",
      input: "textarea",
      sendButton: 'button[data-testid="send-button"]',
    },
    getNewChatUrl: () => "https://chatgpt.com",
  },
  qwen: {
    id: "qwen",
    name: "Qwen",
    type: "bridge",
    baseUrl: "https://chat.qwenlm.ai",
    selectors: {
      assistantMessage: ".markdown-content", // Базовый селектор для Qwen
      streamingIndicator: ".typing", 
      input: "textarea",
      sendButton: 'button[type="submit"]',
    },
    getNewChatUrl: () => "https://chat.qwenlm.ai",
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    type: "bridge",
    baseUrl: "https://chat.deepseek.com",
    selectors: {
      assistantMessage: ".ds-markdown--block", // Базовый селектор для DeepSeek
      streamingIndicator: ".ds-loading",
      input: "textarea",
      sendButton: 'button[type="submit"]',
    },
    getNewChatUrl: () => "https://chat.deepseek.com",
  },
};

/**
 * Роутер провайдеров (Core Logic)
 */
export class ProviderRouter {
  private static registry: ProviderProfileRegistry = { profiles: {} };

  static registerProfile(profile: ProviderProfile) {
    this.registry.profiles[profile.id] = profile;
  }

  static getProfiles(role: RuntimeRole): ProviderProfile[] {
    return Object.values(this.registry.profiles).filter(p => {
      if (role === "creator") return true;
      return p.visibility === "user" && p.mode === "api";
    });
  }

  /**
   * Возвращает адаптер на основе ID провайдера из сессии чата.
   */
  static getAdapterByKind(kind: ProviderKind): ProviderAdapter {
    const key = kind.split('_')[0];
    const adapter = PROVIDERS[key];
    if (!adapter) {
      throw new Error(`Adapter for kind ${kind} not found`);
    }
    return adapter;
  }
}