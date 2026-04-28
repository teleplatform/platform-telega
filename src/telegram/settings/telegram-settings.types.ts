export type ProviderSetting =
  | "auto"
  | "ollama_local"
  | "openai_web"
  | "qwen_web"
  | "deepseek_web";

export type TelegramSessionSettings = {
  bridge_enabled: boolean;
  provider: ProviderSetting;
  creatorMode?: boolean;
  voice_enabled?: boolean;
  language?: "ru";
};
