import OpenAI from "openai";
import type { ChatRequest } from "../../types/chat.js";

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
      } else if (bridgeModel === "qwen") {
        result = await this.callQwen(prompt, ctx?.system, traceId);
      } else if (bridgeModel === "deepseek") {
        result = await this.callDeepSeek(prompt, ctx?.system, traceId);
      } else {
        throw new Error(`Unknown bridge model: ${bridgeModel}`);
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
      throw new Error("OPENAI_API_KEY not configured");
    }

    const isAsciiOnly = /^[\x20-\x7E]+$/.test(apiKey);
    console.log(`[creator-bridge] OpenAI key check: length=${apiKey?.length}, isAscii=${isAsciiOnly}`);
    if (!isAsciiOnly) {
      console.log(JSON.stringify({
        event: "creator_bridge_openai_skipped",
        trace_id: traceId,
        reason: "invalid_api_key_format",
      }));
      throw new Error("invalid_api_key_format");
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

  private async callQwen(
    prompt: string,
    systemPrompt?: string,
    traceId?: string
  ): Promise<string> {
    const apiKey = process.env.QWEN_API_KEY;
    const baseURL = process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1";

    if (!apiKey) {
      console.log(JSON.stringify({
        event: "creator_bridge_qwen_skipped",
        trace_id: traceId,
        reason: "missing_api_key",
      }));
      return JSON.stringify({ success: false, reason: "invalid_api_key", provider: "creator_bridge_qwen" });
    }

    const isAsciiOnly = /^[\x20-\x7E]+$/.test(apiKey);
    if (!isAsciiOnly) {
      console.log(JSON.stringify({
        event: "creator_bridge_qwen_skipped",
        trace_id: traceId,
        reason: "invalid_api_key_format",
      }));
      return JSON.stringify({ success: false, reason: "invalid_api_key", provider: "creator_bridge_qwen" });
    }

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-plus",
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const output = data.choices?.[0]?.message?.content;
    
    if (!output) {
      throw new Error("Qwen response returned no content");
    }
    
    console.log(JSON.stringify({
      event: "creator_bridge_qwen_success",
      trace_id: traceId,
      model: "qwen-plus",
      output_length: output.length,
    }));

    return output;
  }

  private async callDeepSeek(
    prompt: string,
    systemPrompt?: string,
    traceId?: string
  ): Promise<string> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    const baseURL = "https://api.deepseek.com/v1";

    if (!apiKey) {
      console.log(JSON.stringify({
        event: "creator_bridge_deepseek_skipped",
        trace_id: traceId,
        reason: "missing_api_key",
      }));
      return JSON.stringify({ success: false, reason: "invalid_api_key", provider: "creator_bridge_deepseek" });
    }

    const isAsciiOnly = /^[\x20-\x7E]+$/.test(apiKey);
    if (!isAsciiOnly) {
      console.log(JSON.stringify({
        event: "creator_bridge_deepseek_skipped",
        trace_id: traceId,
        reason: "invalid_api_key_format",
      }));
      return JSON.stringify({ success: false, reason: "invalid_api_key", provider: "creator_bridge_deepseek" });
    }

    const messages: Array<{ role: "system" | "user"; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeepSeek API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;
    const output = data.choices?.[0]?.message?.content;
    
    if (!output) {
      throw new Error("DeepSeek response returned no content");
    }
    
    console.log(JSON.stringify({
      event: "creator_bridge_deepseek_success",
      trace_id: traceId,
      model: "deepseek-chat",
      output_length: output.length,
    }));

    return output;
  }
}