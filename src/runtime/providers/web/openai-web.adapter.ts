import {
  WebProviderAdapter,
  WebProviderHealth,
  WebProviderId,
  WebProviderRequest,
  WebProviderResponse,
} from './types';

export class OpenAIWebProviderAdapter implements WebProviderAdapter {
  readonly id: WebProviderId = 'openai_web';

  async health(): Promise<WebProviderHealth> {
    return {
      providerId: this.id,
      status: 'healthy',
      latencyMs: 12,
      lastChecked: Date.now(),
      details: 'MVP placeholder - no real browser session',
    };
  }

  async execute(request: WebProviderRequest): Promise<WebProviderResponse> {
    const start = Date.now();

    // MVP: Controlled structured mock response.
    // No real execution, no external claims.
    const mockContent = `MVP structured response for openai_web. Prompt length: ${request.prompt.length}. Trace: ${request.traceId}`;

    return {
      traceId: request.traceId,
      requestId: request.requestId,
      providerId: this.id,
      status: 'success',
      content: mockContent,
      tokensUsed: 42,
      model: 'gpt-4o-mvp-placeholder',
      latencyMs: Date.now() - start,
      metadata: {
        mode: 'mvp_placeholder',
        governance: 'Provider does not own state',
      },
    };
  }
}
