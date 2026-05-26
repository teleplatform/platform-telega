import { WebProviderId, WebProviderRequest, WebProviderResponse } from './types';
import { OpenAIWebProviderAdapter } from './openai-web.adapter';

const adapterRegistry = new Map<WebProviderId, any>();

// Register known adapters (MVP)
const openaiAdapter = new OpenAIWebProviderAdapter();
adapterRegistry.set('openai_web', openaiAdapter);

export function selectWebProvider(providerId: WebProviderId) {
  const adapter = adapterRegistry.get(providerId);
  if (!adapter) {
    throw new Error(`Unknown web provider: ${providerId}`);
  }
  return adapter;
}

export async function executeViaRouter(request: WebProviderRequest): Promise<WebProviderResponse> {
  const adapter = selectWebProvider(request.providerId);
  return adapter.execute(request);
}
