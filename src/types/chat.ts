export type ChatRequest = {
  message: string;
  model?: string;        // "local-demo" | "openai:gpt-4.1-mini" и т.д.
  system?: string;       // необязательная системная подсказка
  missionId?: string;    // optional mission context for mission-aware chat
  tools?: unknown[];     // tool schemas for LLM function calling
  tool_choice?: "auto" | "none" | Record<string, unknown>;
  meta?: Record<string, any>;

  // Optional request correlation id (propagated through router)
  request_id?: string;

  // Task context for routing (e.g., chat vs reasoning)
  task?: { type?: string };
};

export type ChatUsage = {
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
};

export type ChatMeta = {
  provider?: "local" | "openai" | "persona" | "deepseek" | "qwen" | "creator" | "openai_web" | "qwen_web" | "deepseek_web" | "grok_web" | "kimi_web" | "chatgpt_web" | "perplexity_web" | "claude_web" | "gemini_web" | "poe_web" | "openai_api" | "qwen_api" | "deepseek_api" | "kimi_api" | "kimi_local_web_api" | "openrouter_kimi" | "multi_agent" | "strategy" | "longform" | "kimi_free_local";
  model?: string;
  usage?: ChatUsage;
  fallback_used?: boolean;
  ranked_primary?: string;
  ranked_candidates?: string[];
  role?: "creator" | "user";
  intendedPath?: "bridge" | "api";
  actualPath?: "bridge" | "api";
  candidateProviders?: string[];
  agents?: number;
  execution_mode?: "single" | "multi" | "debate" | "research";
  strategy_reasoning?: string;
  plan?: string;
  error?: string;
  task_intent?: string;
  longform_file_path?: string;
  longform_word_count?: number;
  longform_char_count?: number;
  longform_fallback?: boolean;
  intent?: string;
  fallback?: boolean;
};

export type ChatResponse = {
  id: string;
  model: string;
  output: string;
  tool_calls?: unknown[];
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  meta?: ChatMeta;

  // Router annotations
  request_id?: string;
  latency_ms?: number;
};
