import {
  type InboundPayload,
  type OutputResult,
  createTraceId,
  nowIso,
} from "./contracts.js";
import { categorizeSize, SIZE_POLICY } from "./size-policy.js";
import { chunkTextSmart, reassembleChunks } from "./chunker.js";
import {
  createDocument,
  getDocument,
  chunkAndStoreDocument,
  getChunks,
  processInput,
  getAssembledContext,
} from "./storage.js";
import { sendSmartOutput, analyzeSmart, decideOutputMode, sendTelegramOutput, splitTextSmart, shouldOutputAsFile } from "./output.js";
import { detectRequestType, getExpectedOutputMode, type RequestInterpretation } from "./intent-router.js";
import { logSuccess, logBlocked, logError } from "../runtime/delivery/delivery-evidence.logger.js";
import { recordMetric } from "../runtime/delivery/delivery-metrics.js";

export interface OrchestratorConfig {
  routeChatFn: (req: {
    message: string;
    chatId: string;
    userId: string;
    creatorMode?: boolean;
  }) => Promise<{ output: string; provider?: string }>;
  sendMessageFn: (text: string) => Promise<any>;
}

let bridgeConfig: OrchestratorConfig | null = null;

export function initBridge(cfg: OrchestratorConfig): void {
  bridgeConfig = cfg;
}

export async function processUserMessage(params: {
  text: string;
  userId: string;
  chatId: string;
  messageId: string;
  source?: "telegram" | "web" | "alice";
}): Promise<OutputResult> {
  const {
    text,
    userId,
    chatId,
    messageId,
    source = "telegram",
  } = params;

  const traceId = createTraceId();
  const sizeCheck = categorizeSize(text.length);

  console.log("[bridge] Processing message:", {
    traceId,
    chars: text.length,
    category: sizeCheck.category,
  });

  if (!bridgeConfig) {
    return {
      ok: false,
      method: "text",
      error: "Bridge not initialized. Call initBridge() first.",
    };
  }

   try {
     let processedText = text;

     if (sizeCheck.willChunk && text.length > SIZE_POLICY.directTextCharsMax) {
       const doc = createDocument({
         userId,
         chatId,
         messageId,
         traceId,
         source,
         kind: "text",
         text,
       });

       chunkAndStoreDocument(doc.documentId);
       processedText = getAssembledContext(doc.documentId);

       console.log("[bridge] Document chunked:", {
         documentId: doc.documentId,
         chunks: getChunks(doc.documentId).length,
       });
     }

     const result = await bridgeConfig.routeChatFn({
       message: processedText,
       chatId,
       userId,
       creatorMode: true,
     });

      if (!result?.output) {
        logError(traceId, Number(chatId), "unknown", "api", text.length, "No output from model");
        recordMetric("error");
        return {
          ok: false,
          method: "text",
          error: "No output from model",
        };
      }

     const output = result.output;
     const provider = result.provider || "unknown";

     const interpretation = detectRequestType(text);
     console.log("[bridge] intent detection:", interpretation.type, "forceFile:", interpretation.forceFile);

     if (interpretation.type === "test_scenario") {
       await bridgeConfig.sendMessageFn("Приняла как тестовый сценарий. Могу прогнать классификацию по каждому кейсу.");
       logSuccess(traceId, Number(chatId), provider, "api", text.length, 0, 0);
       recordMetric("success");
       return {
         ok: true,
         method: "text",
         content: "test_scenario_acknowledged",
       };
     }

     const expectedMode = getExpectedOutputMode(interpretation);
     const forceFile = interpretation.type === "large_code_request" || interpretation.forceFile;

      if (forceFile || shouldOutputAsFile(output)) {
        // File delivery - log as success (delivered via file, not via text)
        // Note: actual file sending is handled by the bot after this return
        logSuccess(traceId, Number(chatId), provider, "api", text.length, output.length, 0);
        recordMetric("success");
        return {
          ok: true,
          method: "file",
          content: output,
          caption: `📄 Ответ длинный (${output.length} символов). Файл прикреплён.`,
        };
      }

     const outputSize = categorizeSize(output.length);

     if (outputSize.category === "short") {
       try {
         await bridgeConfig.sendMessageFn(output);
         logSuccess(traceId, Number(chatId), provider, "api", text.length, output.length, 1);
         recordMetric("success");
         return {
           ok: true,
           method: "text",
           content: output,
         };
       } catch (err) {
         logError(traceId, Number(chatId), provider, "api", text.length, String(err));
         recordMetric("error");
         throw err;
       }
     }

     const chunks = splitTextSmart(output);

     try {
       for (let i = 0; i < chunks.length; i++) {
         const chunkText = chunks.length > 1
           ? `[${i + 1}/${chunks.length}]\n\n${chunks[i]}`
           : chunks[i];
         await bridgeConfig.sendMessageFn(chunkText);
         if (i < chunks.length - 1) {
           await new Promise(r => setTimeout(r, 100));
         }
       }
       logSuccess(traceId, Number(chatId), provider, "api", text.length, output.length, chunks.length);
       recordMetric("success");
       return {
         ok: true,
         method: "chunked",
         chunks,
       };
     } catch (err) {
       logError(traceId, Number(chatId), provider, "api", text.length, String(err));
       recordMetric("error");
       throw err;
     }
   } catch (err) {
     console.error("[bridge] Error:", err);
     return {
       ok: false,
       method: "text",
       error: String(err),
     };
   }
}

export async function processUserMessageLegacy(params: {
  text: string;
  userId: string;
  chatId: string;
  messageId: string;
  creatorMode?: boolean;
}): Promise<OutputResult> {
  const { text, userId, chatId, messageId, creatorMode } = params;

  const { sizeCheck, isDirectSafe, shouldFileFallback } = processInput({
    text,
    userId,
    chatId,
    messageId,
    source: "telegram",
  });

  console.log("[bridge] Input processed:", {
    chars: text.length,
    category: sizeCheck.category,
    isDirectSafe,
    shouldFileFallback,
  });

  if (!bridgeConfig) {
    return {
      ok: false,
      method: "text",
      error: "Bridge not initialized",
    };
  }

   try {
     const result = await bridgeConfig.routeChatFn({
       message: text,
       chatId,
       userId,
       creatorMode,
     });

     const provider = result.provider || "unknown";
     const chatIdNum = Number(chatId);
     const traceId = createTraceId();

     if (!result?.output) {
       console.log("[bridge] no output from provider");
       logError(traceId, chatIdNum, provider, "api", text.length, "No output from provider");
       recordMetric("error");
       return {
         ok: false,
         method: "text",
         error: "No output",
       };
     }

     console.log("[bridge] assistant output:", result.output ? result.output.slice(0, 100) : "(empty)");

    // Use DELIVERY CONTRACT for valid output
    const { isInvalidAssistantOutput, deliverAssistantToTelegram, buildDeliveryFailureText } = await import("./output.js");
    
    if (isInvalidAssistantOutput(text, result.output)) {
      console.log("[bridge] invalid output detected, sending failure text");
      try {
        logBlocked(traceId, chatIdNum, provider, "api", text.length, result.output.length, "invalid_output");
        recordMetric("blocked");
      } catch {}
      await bridgeConfig.sendMessageFn(buildDeliveryFailureText());
      return {
        ok: true,
        method: "text",
        content: "delivered_via_failure_text",
      };
    }

    try {
      const res = await sendTelegramOutput(result.output, bridgeConfig.sendMessageFn, text);
      logSuccess(traceId, chatIdNum, provider, "api", text.length, result.output.length, res.chunks?.length || 1);
      recordMetric("success");
      return res;
    } catch (err) {
      logError(traceId, chatIdNum, provider, "api", text.length, String(err));
      recordMetric("error");
      throw err;
    }
   } catch (err) {
     console.error("[bridge] Error:", err);
     return {
       ok: false,
       method: "text",
       error: String(err),
     };
   }
}

export function getDocumentInfo(documentId: string): {
  document: ReturnType<typeof getDocument>;
  chunks: ReturnType<typeof getChunks>;
} {
  return {
    document: getDocument(documentId),
    chunks: getChunks(documentId),
  };
}

export { sendSmartOutput, splitTextSmart, shouldOutputAsFile, analyzeSmart, decideOutputMode, sendTelegramOutput } from "./output.js";
export { chunkTextSmart, reassembleChunks } from "./chunker.js";
export { categorizeSize, SIZE_POLICY } from "./size-policy.js";
export type { OutputResult } from "./contracts.js";