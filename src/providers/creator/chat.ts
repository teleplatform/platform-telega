import type { ExecutionResult } from "../../core/provider-execution.js";
import type { ChatMessage } from "../../core/provider-execution.js";
import { CreatorBridgeProvider } from "./creator-bridge.js";

const creatorBridge = new CreatorBridgeProvider();

export async function callCreator(
  model: string,
  messages: ChatMessage[],
  systemPrompt?: string
): Promise<ExecutionResult> {
  const creatorBridgeEnabled = process.env.CREATOR_BRIDGE_ENABLED === "1";
  
  if (!creatorBridgeEnabled) {
    return {
      ok: false,
      provider: "chatgpt_web" as any,
      model,
      error: { 
        type: "auth", 
        message: "Creator bridge not enabled. Set CREATOR_BRIDGE_ENABLED=1" 
      },
      fallbackUsed: false,
    };
  }

  const userMessage = messages.at(-1)?.content || "";
  
  let bridgeModel: "openai" | "qwen" | "deepseek" = "openai";
  if (model.includes("qwen")) {
    bridgeModel = "qwen";
  } else if (model.includes("deepseek")) {
    bridgeModel = "deepseek";
  }

  try {
    const result = await creatorBridge.generate(userMessage, {
      bridge_model: bridgeModel,
      system: systemPrompt,
      trace_id: `creator-${Date.now()}`,
    });

    return {
      ok: true,
      provider: "chatgpt_web" as any,
      model,
      text: result,
      fallbackUsed: false,
    };
  } catch (e: any) {
    const errorMessage = e?.message || "unknown error";
    const isNetwork = errorMessage.includes("ECONNREFUSED") || 
                      errorMessage.includes("ETIMEDOUT") || 
                      errorMessage.includes("network");
    const isAuth = errorMessage.includes("401") || errorMessage.includes("auth") || errorMessage.includes("API key");
    
    return {
      ok: false,
      provider: "chatgpt_web" as any,
      model,
      error: {
        type: isAuth ? "auth" : isNetwork ? "network" : "unknown",
        message: errorMessage,
      },
      fallbackUsed: false,
    };
  }
}