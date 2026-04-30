export type RuntimeStatus = 'ready' | 'loading' | 'offline' | 'degraded' | 'streaming';

export type Role = 'user' | 'assistant' | 'system';

export type Mode = 'public' | 'maker';

export interface MessageMeta {
  requestId?: string;
  provider?: string;
  model?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  warnings?: string[];
  traceId?: string;
  raw?: string;
  contractStatus?: 'ok' | 'fail';
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  meta?: MessageMeta;
  error?: {
    code: 'TIMEOUT' | 'PROVIDER_FAIL' | 'INVALID_TAG';
    details?: string;
  };
}

export interface Model {
  id: string;
  provider: string;
  name: string;
}
