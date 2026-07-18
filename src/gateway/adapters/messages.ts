import type { ChatRequest } from "../../types/chat.js";

export interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

export interface OpenAiChatRequest {
  model: string;
  messages: OpenAiMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: "auto" | "none" | "required" | Record<string, unknown>;
}

export function openAiToChatRequest(
  body: OpenAiChatRequest,
  requestId: string
): ChatRequest {
  let systemPrompt: string | undefined;
  const userMessages: string[] = [];

  for (const msg of body.messages) {
    if (msg.role === "system") {
      systemPrompt = msg.content || undefined;
    } else if (msg.role === "user") {
      userMessages.push(msg.content || "");
    } else if (msg.role === "assistant" && msg.content) {
      userMessages.push(`Assistant: ${msg.content}`);
    } else if (msg.role === "tool" && msg.content) {
      userMessages.push(`Tool result (${msg.tool_call_id}): ${msg.content}`);
    }
  }

  const lastUserMessage = userMessages.length > 0
    ? userMessages[userMessages.length - 1]
    : "";

  const contextPrefix = userMessages.length > 1
    ? userMessages.slice(0, -1).join("\n\n") + "\n\n"
    : "";

  const fullMessage = contextPrefix
    ? contextPrefix + lastUserMessage
    : lastUserMessage;

  const request: ChatRequest = {
    message: fullMessage,
    model: body.model,
    system: systemPrompt,
    request_id: requestId,
  };

  if (body.tools && body.tools.length > 0) {
    request.tools = body.tools;
  }
  if (body.tool_choice) {
    request.tool_choice = body.tool_choice;
  }

  return request;
}
