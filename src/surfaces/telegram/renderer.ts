import { BridgeOutput, LANGUAGE_EXTENSION_MAP } from "./output-normalization";

export interface TelegramRenderResult {
  method: "sendMessage" | "sendDocument";
  payload: {
    text?: string;
    document?: string; // Здесь может быть контент для Buffer или путь
    filename?: string;
    caption?: string; 
    parse_mode?: "MarkdownV2" | "HTML";
  };
}

export class TelegramRenderer {
  private static readonly CODE_FILE_THRESHOLD = 2048;

  private static sanitizeText(text: string): string {
    return (text ?? "")
      .replace(/\u0000/g, "")
      .replace(/\r/g, "");
  }

  static render(output: BridgeOutput): TelegramRenderResult {
    switch (output.kind) {
      case "text":
        return {
          method: "sendMessage",
          payload: {
            text: this.sanitizeText(output.text),
          },
        };

      case "markdown":
        return {
          method: "sendDocument",
          payload: {
            document: output.text,
            filename: "response.md",
            caption: "Rich text content",
          },
        };

      case "code":
        if (output.code.length > this.CODE_FILE_THRESHOLD) {
          return {
            method: "sendDocument",
            payload: {
              document: output.code,
              filename: `script.${this.mapExtension(output.language)}`,
              caption: `Source code: ${output.language}`,
            },
          };
        }

        const safeCode = output.code.replace(/[`\\]/g, "\\$&");

        return {
          method: "sendMessage",
          payload: {
            text: `\`\`\`${output.language}\n${safeCode}\n\`\`\``,
            parse_mode: "MarkdownV2",
          },
        };

      case "file":
        return {
          method: "sendDocument",
          payload: {
            document: output.content,
            filename: output.filename,
          },
        };
    }
  }

  private static mapExtension(lang: string): string {
    return LANGUAGE_EXTENSION_MAP[(lang || "").toLowerCase()] || "txt";
  }
}