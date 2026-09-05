import type { ArtifactClassification, DeliveryPlan } from "./artifact-types.js";
import { extractCodeBlocks } from "./artifact-classifier.js";

// TGR-6.49: Utility to extract files for delivery
function extractFilesForPlan(text: string, classification: ArtifactClassification): Array<{ filename: string; content: string }> {
  const blocks = extractCodeBlocks(text);

  if (classification.type === "multi_file" || classification.type === "zip_project") {
    const files = blocks
      .filter(b => b.filename)
      .map(b => ({
        filename: b.filename!,
        content: b.content
      }));

    if (files.length > 0) return files;
  }

  if (classification.type === "code_file") {
    const mainBlock = blocks.find(b => b.content.length > 100) || blocks[0];
    return [{
      filename: mainBlock?.filename || classification.filename || "output.txt",
      content: mainBlock?.content || text
    }];
  }

  return [];
}

export const TELEGRAM_CHUNK_SIZE = 3200;
export const TELEGRAM_FILE_THRESHOLD = 12000;
export const TELEGRAM_SINGLE_LIMIT = 3500;

function makeSummary(classification: ArtifactClassification): string | undefined {
  const { type, stats, isExplicitFileRequest } = classification;
  if (stats.chars <= TELEGRAM_SINGLE_LIMIT && !isExplicitFileRequest) return undefined;

  const sizeLabel = stats.chars >= 1000
    ? `${(stats.chars / 1000).toFixed(0)}k символов`
    : `${stats.chars} символов`;

  if (isExplicitFileRequest) {
    if (classification.reason.includes("Explicit both")) {
      return `Готово, отправляю файлы и дублирую код ниже 👇 (${sizeLabel})`;
    }
    return `Готово, отправляю файлы ниже 👇 (${sizeLabel})`;
  }

  if (classification.reason.includes("KiloCode")) {
    return `KiloCode Bridge: Задача выполнена. Отчёты и результаты ниже 👇 (${sizeLabel})`;
  }

  switch (type) {
    case "code_file":
      return `Code file (${sizeLabel}, ${stats.codeBlocks} block${stats.codeBlocks !== 1 ? "s" : ""}). Attached as file.`;
    case "multi_file":
    case "zip_project":
      return `Project (${sizeLabel}, ${stats.codeBlocks} files). Attached as zip.`;
    case "capsule":
      return `Capsule (${sizeLabel}). Attached as file.`;
    case "report":
      return `Report (${sizeLabel}). Full version attached as file.`;
    default:
      return `Large response (${sizeLabel}). Full version attached as file.`;
  }
}

export function resolveDeliveryPolicy(text: string, classification: ArtifactClassification): DeliveryPlan {
  const { type, delivery, filename, stats } = classification;

  switch (delivery) {
    case "message": {
      const summary = makeSummary(classification);
      return {
        method: "message",
        description: `Deliver as single message (${stats.chars} chars, ${type})`,
        telegram: {
          chunkSize: TELEGRAM_CHUNK_SIZE,
          fileThreshold: TELEGRAM_FILE_THRESHOLD,
        },
        artifact: {
          filename: filename ?? undefined,
          summary,
          totalChars: stats.chars,
          totalLines: stats.lines,
        },
      };
    }

    case "chunks": {
      const chunkCount = Math.ceil(stats.chars / TELEGRAM_CHUNK_SIZE);
      const isExplicitMessage = classification.reason.includes("Explicit message delivery");
      return {
        method: "chunks",
        description: `Deliver as ${chunkCount} chunked messages (${stats.chars} chars, ${type})`,
        telegram: {
          chunkSize: TELEGRAM_CHUNK_SIZE,
          fileThreshold: TELEGRAM_FILE_THRESHOLD,
          chunkCount,
        },
        artifact: {
          filename: filename ?? undefined,
          summary: isExplicitMessage ? `Готово, показываю код прямо здесь 👇` : undefined,
          totalChars: stats.chars,
          totalLines: stats.lines,
        },
      };
    }

    case "file": {
      return {
        method: classification.isExplicitFileRequest ? "file_with_preview" : "file",
        description: `Deliver as file attachment (${stats.chars} chars, ${type})`,
        telegram: {
          chunkSize: TELEGRAM_CHUNK_SIZE,
          fileThreshold: TELEGRAM_FILE_THRESHOLD,
        },
        artifact: {
          filename: filename ?? "output.md",
          summary: makeSummary(classification),
          totalChars: stats.chars,
          totalLines: stats.lines,
          extractedFiles: extractFilesForPlan(text, classification),
        },
      };
    }

    case "file_with_preview": {
      return {
        method: "file_with_preview",
        description: `Deliver as file with summary preview (${stats.chars} chars, ${type})`,
        telegram: {
          chunkSize: TELEGRAM_CHUNK_SIZE,
          fileThreshold: TELEGRAM_FILE_THRESHOLD,
        },
        artifact: {
          filename: filename ?? "output.md",
          summary: makeSummary(classification),
          totalChars: stats.chars,
          totalLines: stats.lines,
          extractedFiles: extractFilesForPlan(text, classification),
        },
      };
    }

    case "zip": {
      return {
        method: "zip",
        description: `Deliver as zip archive (${stats.chars} chars, ${type})`,
        telegram: {
          chunkSize: TELEGRAM_CHUNK_SIZE,
          fileThreshold: TELEGRAM_FILE_THRESHOLD,
        },
        artifact: {
          filename: filename ?? "sources.zip",
          summary: makeSummary(classification),
          totalChars: stats.chars,
          totalLines: stats.lines,
          extractedFiles: extractFilesForPlan(text, classification),
        },
      };
    }

    default:
      return {
        method: "message",
        description: `Fallback to message delivery`,
        telegram: {
          chunkSize: TELEGRAM_CHUNK_SIZE,
          fileThreshold: TELEGRAM_FILE_THRESHOLD,
        },
        artifact: {
          totalChars: stats.chars,
          totalLines: stats.lines,
        },
      };
  }
}
