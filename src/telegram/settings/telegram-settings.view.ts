import { Markup } from "telegraf";
import type {
  ProviderSetting,
  TelegramSessionSettings,
} from "./telegram-settings.types";

export function renderSettingsText(s: TelegramSessionSettings): string {
  return [
    "⚙️ Настройки Tele•GPT",
    "",
    `Bridge: ${s.bridge_enabled ? "ON" : "OFF"}`,
    `Provider: ${s.provider || "auto"}`,
    `Mode: ${s.creatorMode ? "Creator" : "Normal"}`,
    `Voice: ${s.voice_enabled ? "ON" : "OFF"}`,
    `Language: ${(s.language || "ru").toUpperCase()}`,
    "",
    "Выбери, что изменить:",
  ].join("\n");
}

export function renderSettingsKeyboard(s: TelegramSessionSettings) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        s.bridge_enabled ? "Bridge: ON" : "Bridge: OFF",
        "settings:bridge_toggle"
      ),
    ],
    [
      Markup.button.callback(
        `Provider: ${s.provider || "auto"}`,
        "settings:provider_open"
      ),
    ],
    [
      Markup.button.callback(
        s.creatorMode ? "Mode: Creator" : "Mode: Normal",
        "settings:mode_toggle"
      ),
    ],
    [
      Markup.button.callback(
        s.voice_enabled ? "Voice: ON" : "Voice: OFF",
        "settings:voice_toggle"
      ),
    ],
    [
      Markup.button.callback(
        `Language: ${(s.language || "ru").toUpperCase()}`,
        "settings:language_cycle"
      ),
    ],
    [Markup.button.callback("⬅ Back", "settings:back")],
  ]);
}

export function renderProviderSelectorText(current: ProviderSetting): string {
  return [
    "🧠 Выбор провайдера",
    "",
    `Текущий: ${current}`,
    "",
    "Выбери provider для runtime:",
  ].join("\n");
}

function providerLabel(current: ProviderSetting, value: ProviderSetting, title: string) {
  return current === value ? `✅ ${title}` : title;
}

export function renderProviderSelectorKeyboard(current: ProviderSetting) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        providerLabel(current, "auto", "Auto"),
        "settings:provider:auto"
      ),
    ],
    [
      Markup.button.callback(
        providerLabel(current, "ollama_local", "Ollama Local"),
        "settings:provider:ollama_local"
      ),
    ],
    [
      Markup.button.callback(
        providerLabel(current, "openai_web", "OpenAI Web"),
        "settings:provider:openai_web"
      ),
    ],
    [
      Markup.button.callback(
        providerLabel(current, "qwen_web", "Qwen Web"),
        "settings:provider:qwen_web"
      ),
    ],
    [
      Markup.button.callback(
        providerLabel(current, "deepseek_web", "DeepSeek Web"),
        "settings:provider:deepseek_web"
      ),
    ],
    [Markup.button.callback("⬅ Back to Settings", "settings:provider:back")],
  ]);
}
