export type ChatRequest = {
  message: string;
  model?: string;        // "local-demo" | "openai:gpt-4.1-mini" и т.д.
  system?: string;       // необязательная системная подсказка
  meta?: Record<string, any>;

  // Optional request correlation id (propagated through router)
  request_id?: string;
};

export type ChatUsage = {
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
};

export type ChatMeta = {
  provider?: "local" | "openai";
  model?: string;
  usage?: ChatUsage;
};

export type ChatResponse = {
  id: string;
  model: string;
  output: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  meta?: ChatMeta;

  // Router annotations
  request_id?: string;
  latency_ms?: number;
};
