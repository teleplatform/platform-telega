import { WebProviderRequest, WebProviderResponse } from './types';
import { executeViaRouter } from './provider-router';

export interface WebBridgeRequest {
  traceId?: string;
  requestId?: string;
  providerId: string;
  prompt: string;
  systemPrompt?: string;
}

export interface WebBridgeResult {
  traceId: string;
  requestId: string;
  providerId: string;
  status: string;
  response: WebProviderResponse;
}

export async function executeWebProviderBridge(input: WebBridgeRequest): Promise<WebBridgeResult> {
  const traceId = input.traceId || `tr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const requestId = input.requestId || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const request: WebProviderRequest = {
    traceId,
    requestId,
    providerId: input.providerId as any,
    prompt: input.prompt,
    systemPrompt: input.systemPrompt,
  };

  const response = await executeViaRouter(request);

  return {
    traceId,
    requestId,
    providerId: response.providerId,
    status: response.status,
    response,
  };
}
