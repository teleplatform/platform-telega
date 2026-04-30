import { ChatSession, BridgeOutput } from "../types/chat-session";
import { ProviderRouter } from "../provider/provider-router";
import { ResponseExtractor } from "../server/middleware/response-extractor";
import { OutputClassifier } from "../server/middleware/output-normalization";
import { TelegramRenderer, TelegramRenderResult } from "../surfaces/telegram/renderer";

export class ExecutionRuntime {
  /**
   * Основной цикл исполнения запроса
   */
  static async execute(
    chat: ChatSession,
    userText: string,
    runtime: { browser?: any; page?: any }
  ): Promise<TelegramRenderResult> {
    let rawResponse = "";

    try {
      if (chat.provider.endsWith("_web")) {
        rawResponse = await this.executeBridge(chat, userText, runtime);
      } else {
        rawResponse = await this.executeApi(chat, userText);
      }

      const output = OutputClassifier.classify(rawResponse, userText);

      // Обновляем состояние чата
      chat.lastAssistantText = rawResponse;
      chat.updatedAt = Date.now();
      
      if (OutputClassifier.detectStuckContext(rawResponse)) {
        chat.stuckCounter = (chat.stuckCounter || 0) + 1;
      } else {
        chat.stuckCounter = 0;
      }

      return TelegramRenderer.render(output);
    } catch (e: any) {
      return TelegramRenderer.render({
        kind: "text",
        text: `❌ Ошибка исполнения: ${e.message}`
      });
    }
  }

  private static async executeBridge(
    chat: ChatSession,
    userText: string,
    runtime: { browser?: any; page?: any }
  ): Promise<string> {
    const adapter = ProviderRouter.getAdapterByKind(chat.provider);
    if (!runtime.page) {
      throw new Error("Браузер не инициализирован");
    }

    const selectors = adapter.selectors;
    if (!selectors?.input || !selectors?.sendButton) {
      throw new Error(`Bridge selectors are incomplete for provider ${chat.provider}`);
    }

    const page = runtime.page;
    const input = page.locator(selectors.input).first();
    const sendButton = page.locator(selectors.sendButton).first();

    await input.waitFor({ state: "visible", timeout: 10000 });
    await input.fill("");
    await input.fill(userText);

    await sendButton.waitFor({ state: "visible", timeout: 10000 });
    await sendButton.click();

    return await ResponseExtractor.extractStableAssistantMessage(page, selectors);
  }

  private static async executeApi(chat: ChatSession, userText: string): Promise<string> {
    // Заглушка для PHASE 2
    return `[API Response from ${chat.provider}] Это ответ на ваш запрос: ${userText}`;
  }
}