import { ProviderRouter, PROVIDERS } from "../../providers/provider-router";
import { ChatSession, RuntimeSessionState, FeatureModuleId, FeatureStatus } from "../../types/chat-session";
import { resetToNewChat } from "./session-reset";

const FEATURE_REGISTRY: Record<FeatureModuleId, { status: FeatureStatus; role: string }> = {
  alice_bridge: { status: "planned", role: "Voice/Dialog Ingress Surface" },
  spyglass: { status: "placeholder", role: "Research & Observation" },
  t800: { status: "placeholder", role: "Controlled Execution" },
  sigma_forge_ide_bridge: { status: "planned", role: "IDE / Patch / Build Engineering" },
  telegpt_intake_surface: { status: "active", role: "Inbound Capture Surface" },
  mcp_kilo_code: { status: "planned", role: "MCP Code Execution / Sandbox" },
  voice: { status: "planned", role: "Voice Synthesis" },
  images: { status: "planned", role: "Image Generation" },
  skills: { status: "planned", role: "Tool Execution" },
  mcp: { status: "planned", role: "Model Context Protocol" },
};

/**
 * Слой управления сессией (PHASE 2)
 * Отвечает за команды /new, /provider, /status, /restart
 */
export class SessionControlLayer {
  /**
   * Обработка команды /new (Reset session)
   */
  static async handleNewChat(chat: ChatSession, runtime: { browser: any; page?: any }): Promise<string> {
    await resetToNewChat(chat, runtime);
    const adapter = ProviderRouter.getAdapterByKind(chat.provider);
    return `🆕 Сессия ${adapter.name} для чата "${chat.title}" сброшена.`;
  }

  /**
   * Обработка команды /provider (Switch provider)
   */
  static handleSwitchProvider(chat: ChatSession, providerKind: string, role: "creator" | "user"): string {
    try {
      if (role !== "creator" && providerKind.endsWith("_web")) {
        throw new Error("Access denied: Bridge providers are creator-only.");
      }
      chat.provider = providerKind as any;
      return `✅ Переключено на: ${providerKind}. Рекомендуется выполнить /new.`;
    } catch (e: any) {
      return `❌ Ошибка: ${e.message}`;
    }
  }

  /**
   * Обработка команды /status
   */
  static async getStatus(chat: ChatSession, page?: any): Promise<string> {
    const adapter = ProviderRouter.getAdapterByKind(chat.provider);
    const url = page ? page.url() : "N/A";
    return [
      `📊 *Tele•GPT Status*`,
      `• Chat: \`${chat.title}\``,
      `• Provider: \`${chat.provider}\``,
      `• Context: \`${chat.contextId.slice(0, 8)}\``,
      `• Bridge: \`${chat.bridgeEnabled ? "ON" : "OFF"}\``,
      `• Stuck: \`${chat.stuckCounter ?? 0}\``,
      `• URL: \`${url}\``
    ].join("\n");
  }

  static handleFeatureInfo(featureId: FeatureModuleId): string {
    const feat = FEATURE_REGISTRY[featureId];
    if (!feat) return "Unknown module.";
    return [
      `🛠 *${featureId.toUpperCase()} Module*`,
      `Status: \`${feat.status}\``,
      `Role: ${feat.role}`,
      `Activation: Phase 4-6`
    ].join("\n");
  }

  /**
   * Обработка команды /restart (Intent for full browser restart)
   */
  static async handleRestart(): Promise<string> {
    // Логика физического перезапуска контекста обычно находится в Orchestrator
    return `🔄 Команда на перезапуск браузера получена. Выполняется системный сброс...`;
  }

  /**
   * Основной диспетчер команд управления (Command Router)
   */
  static async dispatch(command: string, session: RuntimeSessionState, runtime: { browser: any; page?: any }): Promise<string | null> {
    const parts = command.trim().split(" ");
    const cmd = parts[0].toLowerCase();
    const activeChat = session.currentChatId ? session.chats[session.currentChatId] : null;
    if (!activeChat) return "❌ Нет активного чата.";

    if (session.role !== "creator" && ["/new", "/provider", "/status", "/restart"].includes(cmd)) {
      return null;
    }

    switch (cmd) {
      case "/new":
        return await this.handleNewChat(activeChat, runtime);
      case "/provider":
        if (parts[1]) return this.handleSwitchProvider(activeChat, parts[1], session.role);
        return `ℹ️ Используйте: \`/provider <id>\`. Доступные: ${Object.keys(PROVIDERS).join(", ")}`;
      case "/status":
        return await this.getStatus(activeChat, runtime.page);
      case "/restart":
        return await this.handleRestart();
      default:
        return null; // Сообщение не является командой управления
    }
  }
}