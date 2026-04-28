import type { WebProvider, WebExecuteInput, WebExecuteResult, WebProviderHealth } from './web-provider.types';

export async function getWebProviderHealth(
  provider: WebProvider
): Promise<WebProviderHealth> {
  return {
    provider,
    transport: 'cdp',
    ready: false,
    reason: 'web_provider_disabled',
  };
}

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
