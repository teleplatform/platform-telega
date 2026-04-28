export type WebProvider = "chatgpt_web" | "deepseek_web" | "qwen_web";

export type WebActionType = "open" | "send" | "wait" | "read" | "select";

export type WebPolicyVerdict = "allowed" | "slow_mode" | "paused" | "blocked";

export type WebSelfTestResult =
  | { ok: true; details: Record<string, any> }
  | { ok: false; reason: string; details?: Record<string, any> };

export type WebRunResult =
  | { ok: true; answer: string; meta?: Record<string, any> }
  | { ok: false; error: string; meta?: Record<string, any> };

export type AdapterSelectors = {
  input: string;
  send: string;
  lastAnswer: string;
  loginHint?: string;
};

export type WebProviderAdapter = {
  id: WebProvider;
  baseUrl: string;
  selectors: AdapterSelectors;

  selfTest(): Promise<WebSelfTestResult>;
  runChat(prompt: string): Promise<WebRunResult>;
};
