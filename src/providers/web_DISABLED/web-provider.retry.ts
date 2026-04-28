import type { WebProvider } from './web-provider.types';
import { getActiveWebRuntimePolicy } from './web-provider.policy-apply';

export interface WebRetryPolicy {
  maxAttemptsPerRun: number;
  maxRetriesPerProvider: number;
  retryableReasons: string[];
}

export function getRetryPolicy(): WebRetryPolicy {
  const policy = getActiveWebRuntimePolicy();
  return {
    maxAttemptsPerRun: 3,
    maxRetriesPerProvider: policy.maxRetriesPerProvider,
    retryableReasons: [
      'provider_timeout',
      'temporary_dom_read_failure',
      'response_timeout',
    ],
  };
}

export function isRetryableReason(reason?: string): boolean {
  if (!reason) return false;
  const retryPolicy = getRetryPolicy();
  return retryPolicy.retryableReasons.some((r) =>
    reason.toLowerCase().includes(r.toLowerCase())
  );
}

export function shouldRetryProvider(
  provider: WebProvider,
  reason: string | undefined,
  attemptCountForProvider: number
): boolean {
  if (!isRetryableReason(reason)) return false;
  const retryPolicy = getRetryPolicy();
  return attemptCountForProvider < retryPolicy.maxRetriesPerProvider;
}