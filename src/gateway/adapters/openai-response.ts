import { randomUUID } from "node:crypto";
import type { ChatResponse } from "../../types/chat.js";

export interface OpenAiChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop" | "tool_calls" | "length" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  system_fingerprint?: string;
}

export interface OpenAiModelEntry {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export function toOpenAiResponse(
  chatResponse: ChatResponse,
  requestedModel: string
): OpenAiChatCompletionResponse {
  const content = chatResponse.output || "";
  const toolCalls = chatResponse.tool_calls as any[] | undefined;

  const message: { role: "assistant"; content: string; tool_calls?: any[] } = {
    role: "assistant",
    content: toolCalls && toolCalls.length > 0 ? "" : content,
  };

  if (toolCalls && toolCalls.length > 0) {
    message.tool_calls = toolCalls.map((tc: any, idx: number) => ({
      id: tc.id || `call_${randomUUID().slice(0, 8)}`,
      type: "function",
      function: {
        name: tc.function?.name || tc.name || `tool_${idx}`,
        arguments: typeof tc.function?.arguments === "string"
          ? tc.function.arguments
          : JSON.stringify(tc.function?.arguments || {}),
      },
    }));
  }

  let finishReason: "stop" | "tool_calls" | "length" | null = "stop";
  if (toolCalls && toolCalls.length > 0) finishReason = "tool_calls";

  return {
    id: chatResponse.id || `chatcmpl-${randomUUID().slice(0, 12)}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [
      {
        index: 0,
        message: message as { role: "assistant"; content: string },
        finish_reason: finishReason,
      },
    ],
    usage: chatResponse.usage
      ? {
          prompt_tokens: chatResponse.usage.inputTokens || 0,
          completion_tokens: chatResponse.usage.outputTokens || 0,
          total_tokens: chatResponse.usage.totalTokens || 0,
        }
      : undefined,
  };
}

export function toOpenAiModelList(
  models: Array<{ id: string; owned_by?: string }>
): { object: "list"; data: OpenAiModelEntry[] } {
  return {
    object: "list",
    data: models.map((m) => ({
      id: m.id,
      object: "model" as const,
      created: Math.floor(Date.now() / 1000),
      owned_by: m.owned_by || "telegpt",
    })),
  };
}

export function toOpenAiError(statusCode: number, message: string, type?: string) {
  return {
    error: {
      message,
      type: type || "invalid_request_error",
      param: null,
      code: null,
    },
  };
}
