/**
 * Узел A: Response Extractor
 * Ответственность: Снять чистый последний ответ assistant после стабилизации (Core logic).
 */

export interface BridgeSelectors {
  assistantMessage: string;
  streamingIndicator: string;
  input: string;
  sendButton: string;
}

export class ResponseExtractor {
  /**
   * Опрашивает DOM до тех пор, пока ответ не перестанет меняться (стабилизируется).
   * Селекторы передаются из адаптера провайдера.
   */
  static async extractStableAssistantMessage(
    page: any, 
    selectors: BridgeSelectors
  ): Promise<string> {
    let last = "";
    let stableCount = 0;
    let nonEmptySeen = false;
    const MAX_ATTEMPTS = 12; 

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const current = await page.evaluate((sel: BridgeSelectors) => {
        const msgs = document.querySelectorAll(sel.assistantMessage);
        const lastMsg = msgs[msgs.length - 1];
        if (!lastMsg) return "";
        
        const isStreaming = !!document.querySelector(sel.streamingIndicator);
        if (isStreaming) return "__streaming__";

        // innerText может схлопывать пробелы. 
        // Для кода безопаснее использовать textContent или проверять наличие <pre>
        const content = (lastMsg as HTMLElement).innerText;
        return content; // Убираем глобальный .trim() на этапе извлечения
      }, selectors);

      // Игнорируем пустые состояния или процесс стриминга
      if (!current || current === "__streaming__") {
        await new Promise(r => setTimeout(r, 500));
        continue;
      }

      nonEmptySeen = true;

      if (current === last) {
        stableCount++;
        // Требуем 3 совпадения подряд для гарантии стабильности
        if (stableCount >= 3 && nonEmptySeen) return current;
      } else {
        stableCount = 0;
      }

      last = current;
      await new Promise(r => setTimeout(r, 500));
    }

    return last;
  }
}