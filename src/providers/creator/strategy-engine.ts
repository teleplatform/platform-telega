import type { SessionProviderId } from "./session/session-registry.js";

export type ExecutionMode = "single" | "multi_agent" | "debate" | "research";

const KNOWN_PROVIDERS: SessionProviderId[] = [
  "chatgpt_web", "qwen_web", "deepseek_web", "grok_web", "kimi_web",
  "perplexity_web", "claude_web", "gemini_web", "poe_web"
];

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

export interface StrategyValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface StrategyDecision {
  selectedStrategy: ExecutionStrategy;
  timestamp: number;
  requestId: string;
  messageLength: number;
}

export interface StrategyEvidence {
  strategy_mode: string;
  selected_providers: string[];
  validation_status: string;
  fallback_used: boolean;
  planner_latency_ms: number;
}

export function validateStrategy(strategy: unknown): StrategyValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  if (!strategy || typeof strategy !== "object") {
    return { valid: false, errors: ["Invalid strategy object"], warnings: [] };
  }
  
  const s = strategy as Record<string, unknown>;
  
  if (!s.mode || !["single", "multi_agent", "debate", "research"].includes(s.mode as string)) {
    errors.push(`Invalid mode: ${s.mode}`);
  }
  
  if (!Array.isArray(s.providers) || s.providers.length === 0) {
    errors.push("Missing providers");
  } else {
    for (const p of s.providers) {
      if (!KNOWN_PROVIDERS.includes(p as SessionProviderId)) {
        errors.push(`Unknown provider: ${p}`);
      }
    }
  }
  
  if (!Array.isArray(s.steps) || s.steps.length === 0) {
    errors.push("Missing steps");
  } else if (s.steps.length > 5) {
    errors.push("Too many steps (max 5)");
  }
  
  if (!s.expectedOutput || typeof s.expectedOutput !== "string") {
    warnings.push("Missing expectedOutput");
  }
  
  if (!s.reasoning || typeof s.reasoning !== "string") {
    warnings.push("Missing reasoning");
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export async function buildStrategyWithGuardrails(
  message: string,
  requestId: string
): Promise<{
  strategy: ExecutionStrategy;
  evidence: StrategyEvidence;
  usedFallback: boolean;
}> {
  const startTime = Date.now();
  
  try {
    const strategy = await buildStrategy(message, requestId);
    const validation = validateStrategy(strategy);
    
    if (!validation.valid) {
      console.log("[strategy-guardrails] Invalid strategy, using fallback", {
        errors: validation.errors,
      });
      
      const fallback = createFallbackStrategy(message);
      return {
        strategy: fallback,
        evidence: {
          strategy_mode: fallback.mode,
          selected_providers: fallback.providers,
          validation_status: `invalid:${validation.errors.join(",")}`,
          fallback_used: true,
          planner_latency_ms: Date.now() - startTime,
        },
        usedFallback: true,
      };
    }
    
    return {
      strategy,
      evidence: {
        strategy_mode: strategy.mode,
        selected_providers: strategy.providers,
        validation_status: "valid",
        fallback_used: false,
        planner_latency_ms: Date.now() - startTime,
      },
      usedFallback: false,
    };
  } catch (e: any) {
    console.error("[strategy-guardrails] Build failed, using fallback", e?.message);
    
    const fallback = createFallbackStrategy(message);
    return {
      strategy: fallback,
      evidence: {
        strategy_mode: fallback.mode,
        selected_providers: fallback.providers,
        validation_status: `error:${e.message}`,
        fallback_used: true,
        planner_latency_ms: Date.now() - startTime,
      },
      usedFallback: true,
    };
  }
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

let lastMemoryContext = "";

export async function buildStrategy(
  message: string,
  requestId: string,
  useMemory = true
): Promise<ExecutionStrategy> {
  const { executeWithFallback } = await import("./provider-intelligence.js");
  
  let memoryContext = "";
  if (useMemory) {
    try {
      const { retrieveSimilarTasks } = await import("./execution-memory.js");
      const { records, fastPathUsed, reusedStrategy } = await retrieveSimilarTasks(message, 3);
      
      if (fastPathUsed && reusedStrategy) {
        console.log("[strategy] using fast-path from memory", reusedStrategy);
        const fastStrategy = createFallbackStrategy(message);
        fastStrategy.mode = reusedStrategy.mode as any;
        fastStrategy.providers = reusedStrategy.providers as any;
        fastStrategy.reasoning = `Faster path from memory: ${reusedStrategy.mode} with ${reusedStrategy.providers.join(", ")}`;
        return fastStrategy;
      }
      
      if (records.length > 0) {
        memoryContext = "\n\nRelevant past executions:\n" + records.map(r => 
          `- mode: ${r.strategy_mode}, providers: ${r.providers_used.join(" → ")}, summary: ${r.result_summary.slice(0, 100)}...`
        ).join("\n");
        console.log("[strategy] memory context found", { count: records.length });
      }
} catch (e: any) {
      console.log("[strategy] memory_lookup failed", e?.message);
    }
  }
  
  const prompt = (STRATEGY_PROMPT + (memoryContext ? `\n\n${memoryContext}` : "")).replace("{task}", message);
  
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

async function recordToMemory(
  originalMessage: string,
  strategy: ExecutionStrategy,
  result: { text: string; provider: string }
): Promise<void> {
  try {
    const { writeMemory } = await import("./execution-memory.js");
    await writeMemory(
      originalMessage,
      strategy.mode as any,
      strategy.providers as any,
      result.text,
      result.text.length > 10,
      1000
    );
  } catch {}
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