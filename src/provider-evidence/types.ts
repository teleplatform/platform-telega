import type { ProviderId } from "../provider-auto-router-v2/types.js";

export interface EvidenceEntry {
  provider: ProviderId;
  model: string;
  intent: string;
  latencyMs: number;
  success: boolean;
  errorType?: string;
  fallbackUsed: boolean;
  tokensIn?: number;
  tokensOut?: number;
  timestamp: number;
}

export interface EvidenceStats {
  provider: ProviderId;
  intent: string;
  totalCalls: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  avgTokensIn: number;
  avgTokensOut: number;
  fallbackRate: number;
  lastCallTimestamp: number;
  recentFailures: number;
}

export interface ProviderStats {
  provider: ProviderId;
  totalCalls: number;
  successRate: number;
  avgLatencyMs: number;
  intents: EvidenceStats[];
}

export interface EvidenceSummary {
  totalEntries: number;
  totalProviders: number;
  totalIntents: number;
  byProvider: ProviderStats[];
  lastEntry?: EvidenceEntry;
}
