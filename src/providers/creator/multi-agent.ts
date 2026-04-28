import { getSessionBridge } from "./session/session-bridge.js";
import type { SessionProviderId } from "./session/session-registry.js";

export type AgentRole = "planner" | "research" | "reasoning" | "creative" | "synth" | "critic";

export interface AgentTask {
  role: AgentRole;
  provider: SessionProviderId;
  prompt: string;
}

export interface MultiAgentResult {
  text: string;
  meta: {
    mode: "single" | "multi" | "debate";
    agents: Array<{
      role: AgentRole;
      provider: SessionProviderId;
      text: string;
    }>;
  };
}

const ROLE_MAPPING: Record<AgentRole, SessionProviderId> = {
  planner: "qwen_web",
  research: "qwen_web",
  reasoning: "deepseek_web",
  creative: "chatgpt_web",
  synth: "chatgpt_web",
  critic: "deepseek_web",
};

export async function executeWithProvider(
  provider: SessionProviderId,
  prompt: string,
  traceId?: string
): Promise<{ text: string; provider: SessionProviderId }> {
  const bridge = getSessionBridge({ fallbackToApi: false });
  bridge.setCreatorMode(true);
  bridge.enableProvider(provider);

  const result = await bridge.generate(prompt, {
    provider,
    traceId: traceId || `agent-${Date.now()}`,
    creatorMode: true,
  });

  return {
    text: result.output_text || "",
    provider,
  };
}

export function shouldUseMultiAgent(message: string): boolean {
  const m = message.toLowerCase();
  return (
    message.length > 500 ||
    m.includes("analyze") ||
    m.includes("compare") ||
    m.includes("strategy") ||
    m.includes("build") ||
    m.includes("design") ||
    m.includes("architecture")
  );
}

export function shouldUseDebate(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("architecture") ||
    m.includes("strategy") ||
    m.includes("compare") ||
    m.includes("risk") ||
    m.includes("security") ||
    m.includes("roadmap") ||
    m.length > 1000
  );
}

export async function multiAgentExecute(
  message: string,
  mode: "multi" | "debate" = "multi"
): Promise<MultiAgentResult> {
  const traceId = `multi-${mode}-${Date.now()}`;
  const agents: MultiAgentResult["meta"]["agents"] = [];
  
  if (mode === "debate") {
    const proposal = await executeWithProvider("chatgpt_web", `
Create the best possible answer for:
${message}
`, traceId);
    agents.push({ role: "creative", provider: proposal.provider, text: proposal.text });

    const critique = await executeWithProvider("deepseek_web", `
Review this answer. Find issues:
${message}

Answer:
${proposal.text}
`, traceId);
    agents.push({ role: "critic", provider: critique.provider, text: critique.text });

    const research = await executeWithProvider("qwen_web", `
Verify facts:
${message}
`, traceId);
    agents.push({ role: "research", provider: research.provider, text: research.text });

    const final = await executeWithProvider("qwen_web", `
Combine:

Answer: ${proposal.text}
Critique: ${critique.text}
Research: ${research.text}

Create final answer:
${message}
`, traceId);
    agents.push({ role: "synth", provider: final.provider, text: final.text });

    return {
      text: final.text,
      meta: { mode: "debate", agents },
    };
  }

  const plan = await executeWithProvider("qwen_web", `Steps for: ${message}`, traceId);
  agents.push({ role: "planner", provider: plan.provider, text: plan.text });

  const research = await executeWithProvider("qwen_web", `Research: ${message}`, traceId);
  agents.push({ role: "research", provider: research.provider, text: research.text });

  const reasoning = await executeWithProvider("deepseek_web", `Analyze: ${message}`, traceId);
  agents.push({ role: "reasoning", provider: reasoning.provider, text: reasoning.text });

  const final = await executeWithProvider("chatgpt_web", `
Task: ${message}

Research: ${research.text}
Analysis: ${reasoning.text}

Combine into final answer:
`, traceId);
  agents.push({ role: "synth", provider: final.provider, text: final.text });

  return {
    text: final.text,
    meta: { mode: "multi", agents },
  };
}

export async function smartExecute(
  message: string,
  options?: {
    forceMode?: "single" | "multi" | "debate";
    preferredProvider?: SessionProviderId;
  }
): Promise<MultiAgentResult> {
  if (options?.preferredProvider) {
    const result = await executeWithProvider(options.preferredProvider, message);
    return {
      text: result.text,
      meta: { mode: "single", agents: [{ role: "creative", provider: result.provider, text: result.text }] },
    };
  }

  const forceMode = options?.forceMode;
  if (forceMode === "single" || !forceMode && !shouldUseMultiAgent(message) && !shouldUseDebate(message)) {
    const result = await executeWithProvider("chatgpt_web", message);
    return {
      text: result.text,
      meta: { mode: "single", agents: [{ role: "creative", provider: result.provider, text: result.text }] },
    };
  }

  if (forceMode === "debate" || shouldUseDebate(message)) {
    return multiAgentExecute(message, "debate");
  }

  return multiAgentExecute(message, "multi");
}