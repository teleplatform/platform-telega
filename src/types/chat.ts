export type ChatRequest = {
  message: string;
  model?: string;        // "local-demo" | "openai:gpt-4.1-mini" и т.д.
  system?: string;       // необязательная системная подсказка
  meta?: Record<string, any>;
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
};
