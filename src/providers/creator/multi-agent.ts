import { getSessionBridge } from "./session/session-bridge.js";
import type { SessionProviderId } from "./session/session-registry.js";
import { logEvidence, type EvidenceLog } from "./provider-intelligence.js";

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
    evidence?: EvidenceLog;
  };
}

const STABLE_CHAIN = ["qwen_web", "deepseek_web", "chatgpt_web"] as const;

const ROLE_PROVIDER: Record<string, SessionProviderId> = {
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
  const evidence: EvidenceLog = {
    requestId: traceId,
    mode,
    providers: [],
    totalLatencyMs: 0,
    finalProvider: "chatgpt_web",
    fallbackCount: 0,
  };
  
  if (mode === "debate") {
    const proposal = await executeWithProvider("chatgpt_web", `
Answer: ${message}
`, traceId);
    agents.push({ role: "creative", provider: proposal.provider, text: proposal.text });
    evidence.providers.push({ provider: proposal.provider, status: "success", outputChars: proposal.text.length });

    const critique = await executeWithProvider("deepseek_web", `
Critique: ${proposal.text}
Find issues.
`, traceId);
    agents.push({ role: "critic", provider: critique.provider, text: critique.text });
    evidence.providers.push({ provider: critique.provider, status: "success", outputChars: critique.text.length });

    const research = await executeWithProvider("qwen_web", `
Verify: ${message}
`, traceId);
    agents.push({ role: "research", provider: research.provider, text: research.text });
    evidence.providers.push({ provider: research.provider, status: "success", outputChars: research.text.length });

    const final = await executeWithProvider("qwen_web", `
Combine:
${proposal.text}
${critique.text}
${research.text}

Final answer for: ${message}
`, traceId);
    agents.push({ role: "synth", provider: final.provider, text: final.text });
    evidence.providers.push({ provider: final.provider, status: "success", outputChars: final.text.length });
    evidence.finalProvider = final.provider;

    logEvidence(evidence);
    return {
      text: final.text,
      meta: { mode: "debate", agents, evidence },
    };
  }

  const plan = await executeWithProvider("qwen_web", `Plan: ${message}`, traceId);
  agents.push({ role: "planner", provider: plan.provider, text: plan.text });
  evidence.providers.push({ provider: plan.provider, status: "success", outputChars: plan.text.length });

  const reasoning = await executeWithProvider("deepseek_web", `Reason: ${message}`, traceId);
  agents.push({ role: "reasoning", provider: reasoning.provider, text: reasoning.text });
  evidence.providers.push({ provider: reasoning.provider, status: "success", outputChars: reasoning.text.length });

  const final = await executeWithProvider("chatgpt_web", `
Task: ${message}
Plan: ${plan.text}
Reasoning: ${reasoning.text}

Final answer:
`, traceId);
  agents.push({ role: "synth", provider: final.provider, text: final.text });
  evidence.providers.push({ provider: final.provider, status: "success", outputChars: final.text.length });
  evidence.finalProvider = final.provider;

  logEvidence(evidence);
  return {
    text: final.text,
    meta: { mode: "multi", agents, evidence },
  };
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
    evidence?: EvidenceLog;
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
    const result = await executeWithProvider("qwen_web", message);
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