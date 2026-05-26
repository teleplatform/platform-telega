export type WebProviderId = 'openai_web' | 'qwen_web' | 'deepseek_web' | 'kimi_web' | 'claude_web';

export type WebProviderStatus = 'healthy' | 'degraded' | 'unavailable' | 'unknown';

export interface WebProviderRequest {
  traceId: string;
  requestId: string;
  providerId: WebProviderId;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface WebProviderResponse {
  traceId: string;
  requestId: string;
  providerId: WebProviderId;
  status: 'success' | 'error' | 'degraded';
  content: string;
  tokensUsed?: number;
  model?: string;
  latencyMs: number;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface WebProviderHealth {
  providerId: WebProviderId;
  status: WebProviderStatus;
  latencyMs: number;
  lastChecked: number;
  details?: string;
}

export interface WebProviderAdapter {
  readonly id: WebProviderId;
  health(): Promise<WebProviderHealth>;
  execute(request: WebProviderRequest): Promise<WebProviderResponse>;
}
