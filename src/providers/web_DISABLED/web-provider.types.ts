export type WebProvider = 'chatgpt_web' | 'qwen_web' | 'deepseek_web';
export type WebTransport = 'extension' | 'cdp';
export interface WebExecuteInput {
  provider: WebProvider;
  prompt: string;
  timeoutMs?: number;
  systemPrompt?: string;
}
export interface WebProviderHealth {
  provider: WebProvider;
  transport: WebTransport;
  ready: boolean;
  loginRequired?: boolean;
  challenge?: boolean;
  reason?: string;
}
export interface WebExecuteResult {
  ok: boolean;
  provider: WebProvider;
  transport: WebTransport;
  responseText?: string;
  reason?: string;
  duration_ms?: number;
  evidence?: string[];
}
