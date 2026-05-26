import type { TransportAdapter, RequestEnvelope, ResponseEnvelope, TransportResult, MessageEnvelope } from './mesh-transport-types.js';
import { createTransportError, normalizeTransportError, DEFAULT_RETRY_POLICY, DEFAULT_TIMEOUT_POLICY } from './mesh-transport-types.js';
import fetch from 'node-fetch';

export class HttpTransportAdapter implements TransportAdapter {
  type: 'http' = 'http';
  constructor(private options: { timeoutMs?: number } = {}) {}

  async send<T>(envelope: RequestEnvelope<T>): Promise<TransportResult<ResponseEnvelope<unknown>>> {
    const url = envelope.targetNodeId; // Assuming targetNodeId contains full URL
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs || DEFAULT_TIMEOUT_POLICY.requestTimeoutMs);
    const start = Date.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(envelope.authToken ? { Authorization: `Bearer ${envelope.authToken}` } : {}) },
        body: JSON.stringify(envelope),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json();
      return { success: true, data, latencyMs: Date.now() - start, retryCount: 0 };
    } catch (err) {
      clearTimeout(timeout);
      const error = normalizeTransportError(err, 'http');
      return { success: false, error, latencyMs: Date.now() - start, retryCount: 0 };
    }
  }

  receive<T>(_handler: (envelope: MessageEnvelope) => Promise<void>): void {
    // For HTTP, inbound handling would be via server routes, not needed here.
  }

  async close(): Promise<void> {}
  async healthCheck(): Promise<boolean> { return true; }
}

export class LocalTransportAdapter implements TransportAdapter {
  type: 'local' = 'local';
  async send<T>(envelope: RequestEnvelope<T>): Promise<TransportResult<ResponseEnvelope<unknown>>> {
    // Direct in-process call placeholder – simply echo back
    return { success: true, data: { requestId: envelope.requestId, statusCode: 200, payload: envelope.payload, timestamp: Date.now(), sourceNodeId: envelope.sourceNodeId, targetNodeId: envelope.targetNodeId, id: envelope.id }, latencyMs: 0, retryCount: 0 };
  }
  receive<T>(_handler: (envelope: MessageEnvelope) => Promise<void>): void {}
  async close(): Promise<void> {}
  async healthCheck(): Promise<boolean> { return true; }
}
