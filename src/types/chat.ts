export type ChatRequest = {
  message: string;
  model?: string;        // "local-demo" | "openai:gpt-4.1-mini" и т.д.
  system?: string;       // необязательная системная подсказка
  meta?: Record<string, any>;
};

export type ChatResponse = {
  id: string;
  model: string;
  output: string;
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
  meta?: Record<string, any>;
};
