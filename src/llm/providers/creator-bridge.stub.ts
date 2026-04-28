import OpenAI from "openai";
import type { ChatRequest, ChatResponse } from "../../types/chat.js";
import { openaiChat } from "../../providers/openai/chat.js";
import { chat as localChat } from "../../providers/local/chat.js";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

export class CreatorBridgeProvider {
  async generate(
    prompt: string,
    ctx?: {
      bridge_model?: "openai" | "qwen" | "deepseek";
      trace_id?: string;
      system?: string;
    }
  ): Promise<string> {
    const bridgeModel = ctx?.bridge_model || "openai";
    const traceId = ctx?.trace_id || `bridge-${Date.now()}`;

    try {
      let result: string;
      if (bridgeModel === "openai") {
        result = await this.callOpenAI(prompt, ctx?.system, traceId);
      } else {
        result = await this.callLocal(prompt, bridgeModel, ctx?.system, traceId);
      }

      try {
        const parsed = JSON.parse(result);
        if (parsed.success === false) {
          throw new Error(parsed.reason || "provider_failed");
        }
      } catch (e: any) {
        if (e instanceof SyntaxError) {
          // Not JSON - it's a normal response
        } else {
          throw e;
        }
      }

      return result;
    } catch (error: any) {
      console.error(`[creator-bridge] ${bridgeModel} call failed:`, error?.message);
      throw error;
    }
  }

  private async callOpenAI(
    prompt: string,
    systemPrompt?: string,
    traceId?: string
  ): Promise<string> {
    const model = process.env.OPENAI_MODEL_DEFAULT || "gpt-4o-mini";
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.log(JSON.stringify({
        event: "creator_bridge_openai_skipped",
        trace_id: traceId,
        reason: "missing_api_key",
      }));
      return JSON.stringify({ success: false, reason: "invalid_api_key", provider: "creator_bridge" });
    }

    const isAsciiOnly = /^[\x20-\x7E]+$/.test(apiKey);
    if (!isAsciiOnly) {
      console.log(JSON.stringify({
        event: "creator_bridge_openai_skipped",
        trace_id: traceId,
        reason: "invalid_api_key_format",
      }));
      return JSON.stringify({ success: false, reason: "invalid_api_key", provider: "creator_bridge" });
    }

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await getOpenAIClient().chat.completions.create({
      model,
      messages,
      temperature: 0.7,
    });

    const output = response.choices?.[0]?.message?.content;
    if (!output) {
      throw new Error("OpenAI response returned no content");
    }
    console.log(JSON.stringify({
      event: "creator_bridge_openai_success",
      trace_id: traceId,
      model,
      output_length: output.length,
    }));

    return output;
  }

  private async callLocal(
    prompt: string,
    model: "qwen" | "deepseek",
    systemPrompt?: string,
    traceId?: string
  ): Promise<string> {
    const localModel = model === "qwen"
      ? process.env.LOCAL_OPENAI_MODEL_DEFAULT || "qwen2.5:7b-instruct"
      : "deepseek-coder:7b-instruct";

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const req: ChatRequest = {
      message: prompt,
      system: systemPrompt,
      model: localModel,
    };

    const response = await localChat(req);
    console.log(JSON.stringify({
      event: "creator_bridge_local_success",
      trace_id: traceId,
      model: localModel,
      output_length: response.output.length,
    }));

    return response.output;
  }
}
