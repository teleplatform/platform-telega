import type { SessionProviderId } from "./session/session-registry.js";

export type ExecutionMode = "single" | "multi_agent" | "debate" | "research";

export interface ExecutionStep {
  step: number;
  action: "execute" | "analyze" | "refine" | "synthesize";
  provider: SessionProviderId;
  input: string;
  output?: string;
}

export interface ExecutionStrategy {
  mode: ExecutionMode;
  providers: SessionProviderId[];
  steps: ExecutionStep[];
  expectedOutput: string;
  reasoning: string;
}

export interface StrategyDecision {
  selectedStrategy: ExecutionStrategy;
  timestamp: number;
  requestId: string;
  messageLength: number;
}

const STRATEGY_PROMPT = `You are an execution strategy planner. Analyze the user's task and choose the best execution strategy.

TASK:
{task}

Return ONLY a JSON object with this structure:
{{
  "mode": "single" | "multi_agent" | "research",
  "providers": ["provider_name"],
  "steps": [
    {{"step": 1, "action": "execute", "provider": "provider_name", "input": "what to ask"}}
  ],
  "expectedOutput": "what output to expect",
  "reasoning": "why this strategy"
}}

Rules:
- mode "single" = one provider, simple task
- mode "multi_agent" = multiple providers working together
- mode "research" = find information, use perplexity
- providers must be from: chatgpt_web, qwen_web, deepseek_web, grok_web, kimi_web, perplexity_web, claude_web, gemini_web, poe_web
- If task is about finding news/latest/source → use "research" mode with perplexity_web
- If task is complex and needs multiple perspectives → use "multi_agent" mode
- Always provide reasoning`;

export async function buildStrategy(
  message: string,
  requestId: string
): Promise<ExecutionStrategy> {
  const { executeWithFallback } = await import("./provider-intelligence.js");
  
  const prompt = STRATEGY_PROMPT.replace("{task}", message);
  
  const result = await executeWithFallback("qwen_web", prompt, {
    traceId: requestId,
    timeoutMs: 60000,
    fallbackEnabled: false,
  });
  
  try {
    const strategy = JSON.parse(result.text) as ExecutionStrategy;
    
    if (!strategy.mode || !strategy.providers || !strategy.steps) {
      return createFallbackStrategy(message);
    }
    
    return {
      ...strategy,
      mode: strategy.mode || "single",
      providers: strategy.providers?.filter(p => p) || ["qwen_web"],
      steps: strategy.steps || [],
      reasoning: strategy.reasoning || "Default strategy",
    };
  } catch {
    return createFallbackStrategy(message);
  }
}

function createFallbackStrategy(message: string): ExecutionStrategy {
  const m = message.toLowerCase();
  
  if (m.includes("latest") || m.includes("news") || m.includes("source") || m.includes("research") || m.includes("find") || m.includes("провер") || m.includes("новост") || m.includes("источник")) {
    return {
      mode: "research",
      providers: ["perplexity_web"],
      steps: [{ step: 1, action: "execute", provider: "perplexity_web", input: message }],
      expectedOutput: "research finding with sources",
      reasoning: "Research task detected → perplexity_web",
    };
  }
  
  if (m.length > 500 || m.includes("compare") || m.includes("analyze") || m.includes("сравн") || m.includes("анализ")) {
    return {
      mode: "multi_agent",
      providers: ["deepseek_web", "chatgpt_web"],
      steps: [
        { step: 1, action: "execute", provider: "deepseek_web", input: message },
        { step: 2, action: "analyze", provider: "chatgpt_web", input: message },
      ],
      expectedOutput: "analyzed result",
      reasoning: "Complex task → multi_agent",
    };
  }
  
  if (m.includes("write") || m.includes("document") || m.includes("текст") || m.includes("перепиш")) {
    return {
      mode: "single",
      providers: ["claude_web"],
      steps: [{ step: 1, action: "execute", provider: "claude_web", input: message }],
      expectedOutput: "written content",
      reasoning: "Writing task → claude_web",
    };
  }
  
  return {
    mode: "single",
    providers: ["qwen_web"],
    steps: [{ step: 1, action: "execute", provider: "qwen_web", input: message }],
    expectedOutput: "response",
    reasoning: "Default → qwen_web",
  };
}

export async function executeStrategy(
  strategy: ExecutionStrategy,
  originalMessage: string
): Promise<{
  text: string;
  provider: SessionProviderId;
  evidence: ExecutionStrategy;
}> {
  const { executeWithFallback } = await import("./provider-intelligence.js");
  
  switch (strategy.mode) {
    case "single": {
      const step = strategy.steps[0];
      const result = await executeWithFallback(step.provider, step.input || originalMessage, {
        traceId: `strategy-${Date.now()}`,
      });
      return {
        text: result.text,
        provider: result.provider,
        evidence: strategy,
      };
    }
    
    case "research": {
      const result = await executeWithFallback("perplexity_web", originalMessage, {
        traceId: `strategy-${Date.now()}`,
      });
      return {
        text: result.text,
        provider: result.provider,
        evidence: strategy,
      };
    }
    
    case "multi_agent": {
      let combinedInput = originalMessage;
      
      for (const step of strategy.steps) {
        const result = await executeWithFallback(step.provider, combinedInput, {
          traceId: `strategy-${Date.now()}`,
        });
        
        step.output = result.text;
        
        combinedInput = `${originalMessage}\n\n--- ${step.provider} output:\n${result.text}`;
      }
      
      return {
        text: combinedInput,
        provider: strategy.providers[strategy.providers.length - 1] as SessionProviderId,
        evidence: strategy,
      };
    }
    
    default: {
      const result = await executeWithFallback("qwen_web", originalMessage, {
        traceId: `strategy-${Date.now()}`,
      });
      return {
        text: result.text,
        provider: result.provider,
        evidence: strategy,
      };
    }
  }
}

export function formatStrategySummary(strategy: ExecutionStrategy): string {
  const lines = [
    `🧠 Strategy: ${strategy.mode}`,
    `💡 ${strategy.reasoning}`,
    `📦 Providers: ${strategy.providers.join(" → ")}`,
  ];
  
  if (strategy.steps.length > 0) {
    lines.push(`\nSteps:`);
    for (const step of strategy.steps) {
      lines.push(`  ${step.step}. ${step.action}: ${step.provider}`);
    }
  }
  
  return lines.join("\n");
}