export type TransportType = 'local' | 'http' | 'grpc' | 'websocket';

export interface TransportOptions {
  timeoutMs: number;
  retryPolicy: RetryPolicy;
  auth?: {
    type: 'none' | 'token' | 'certificate';
    token?: string;
    headers?: Record<string, string>;
  };
  compression?: boolean;
  keepAlive?: boolean;
}

export interface RetryPolicy {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBackoff: boolean;
  jitter: boolean;
  retryableErrors: string[];
}

export interface TimeoutPolicy {
  connectTimeoutMs: number;
  requestTimeoutMs: number;
  idleTimeoutMs: number;
}

export interface TransportError extends Error {
  type: 'network' | 'timeout' | 'authentication' | 'authorization' | 'protocol' | 'unknown';
  originalError?: Error;
  retryable: boolean;
  transportType: TransportType;
  timestamp: number;
}

export interface TransportResult<T> {
  success: boolean;
  data?: T;
  error?: TransportError;
  latencyMs: number;
  retryCount: number;
}

export interface TransportEnvelope<T> {
  id: string;
  timestamp: number;
  sourceNodeId: string;
  targetNodeId: string;
  payload: T;
  authToken?: string;
  metadata?: Record<string, unknown>;
  compression?: boolean;
}

export interface MessageEnvelope extends TransportEnvelope<unknown> {
  messageType: string;
  correlationId?: string;
  responseTo?: string;
}

export interface RequestEnvelope<T> extends TransportEnvelope<T> {
  requestId: string;
  timeoutMs: number;
  responseExpected: boolean;
}

export interface ResponseEnvelope<T> extends TransportEnvelope<T> {
  requestId: string;
  statusCode: number;
  headers?: Record<string, string>;
}

export interface TransportAdapter {
  type: TransportType;
  send<T>(envelope: RequestEnvelope<T>): Promise<TransportResult<ResponseEnvelope<unknown>>>;
  receive<T>(handler: (envelope: MessageEnvelope) => Promise<void>): void;
  close(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  exponentialBackoff: true,
  jitter: true,
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'EAI_AGAIN',
  ],
};

export const DEFAULT_TIMEOUT_POLICY: TimeoutPolicy = {
  connectTimeoutMs: 10000,
  requestTimeoutMs: 30000,
  idleTimeoutMs: 300000,
};

export function createTransportError(
  message: string,
  type: TransportError['type'],
  originalError?: Error,
  transportType: TransportType = 'http'
): TransportError {
  return {
    name: 'TransportError',
    message,
    type,
    originalError,
    retryable: isRetryableError(originalError?.message || ''),
    transportType,
    timestamp: Date.now(),
    stack: originalError?.stack,
  };
}

function isRetryableError(errorMessage: string): boolean {
  const retryablePatterns = [
    /ETIMEDOUT/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /EHOSTUNREACH/i,
    /ENETUNREACH/i,
    /EAI_AGAIN/i,
    /timeout/i,
    /connection reset/i,
    /connection refused/i,
    /network unreachable/i,
    /host unreachable/i,
    /temporary failure/i,
  ];
  
  return retryablePatterns.some(pattern => pattern.test(errorMessage));
}

export function normalizeTransportError(
  error: any,
  transportType: TransportType = 'http'
): TransportError {
  if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
    return error as TransportError;
  }
  
  return createTransportError(
    error?.message || 'Unknown transport error',
    'unknown',
    error instanceof Error ? error : undefined,
    transportType
  );
}
