export type WebProvider = 'chatgpt_web' | 'qwen_web' | 'deepseek_web' | 'grok_web' | 'kimi_web';
export type WebTransport = 'cdp';

export interface WebExecuteInput {
  provider: WebProvider;
  prompt: string;
  timeoutMs?: number;
  systemPrompt?: string;
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

export interface WebFallbackAttempt {
  provider: WebProvider;
  ready: boolean;
  executed: boolean;
  ok: boolean;
  reason?: string;
  transport?: WebTransport;
  responseText?: string;
  score?: number;
  cooldownUntil?: number;
  retryPlanned?: boolean;
  explain?: string[];
  rehabStage?: 'probation' | 'recovery' | 'restored';
}

export interface WebFallbackResult {
  ok: boolean;
  provider: WebProvider;
  transport: WebTransport;
  responseText?: string;
  reason?: string;
  attempts: WebFallbackAttempt[];
  selectedProvider?: WebProvider;
  traceSummary?: string[];
  runtimeMode?: 'normal' | 'degraded' | 'incident';
}

export const DEFAULT_WEB_CHAIN: WebProvider[] = [
  'deepseek_web',
];

export async function executeWebProvider(
  input: WebExecuteInput
): Promise<WebExecuteResult> {
  return {
    ok: false,
    provider: input.provider,
    transport: 'cdp',
    reason: 'web_provider_disabled',
  };
}

export async function executeWebProviderWithFallback(
  input: Omit<WebExecuteInput, 'provider'> & {
    preferredProvider?: WebProvider;
    providerChain?: WebProvider[];
  }
): Promise<WebFallbackResult> {
  const chain = input.providerChain?.length
    ? input.providerChain
    : input.preferredProvider
      ? [input.preferredProvider]
      : DEFAULT_WEB_CHAIN;

  const attempts: WebFallbackAttempt[] = [];

  for (const provider of chain) {
    try {
      const result = await executeWebProvider({
        provider,
        prompt: input.prompt,
        timeoutMs: input.timeoutMs,
      });

      if (result.ok) {
        attempts.push({
          provider,
          ready: true,
          executed: true,
          ok: true,
          reason: result.reason,
          transport: result.transport,
          responseText: result.responseText,
        });

        return {
          ...result,
          attempts,
          selectedProvider: provider,
        };
      }

      attempts.push({
        provider,
        ready: true,
        executed: true,
        ok: false,
        reason: result.reason,
        transport: result.transport,
        responseText: result.responseText,
      });
    } catch (e: any) {
      attempts.push({
        provider,
        ready: true,
        executed: true,
        ok: false,
        reason: e?.message || 'execution_error',
      });
    }
  }

  const last = attempts[attempts.length - 1];

  return {
    ok: false,
    provider: last?.provider || 'deepseek_web',
    transport: 'cdp',
    reason: last?.reason || 'all_web_providers_failed',
    attempts,
  };
}
