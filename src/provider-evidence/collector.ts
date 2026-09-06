import type { EvidenceEntry } from "./types.js";
import type { ProviderId } from "../provider-auto-router-v2/types.js";
import { recordEvidence } from "./storage.js";

export function collectEvidence(params: {
  provider: ProviderId;
  model: string;
  intent: string;
  latencyMs: number;
  success: boolean;
  errorType?: string;
  fallbackUsed: boolean;
  tokensIn?: number;
  tokensOut?: number;
}): void {
  const entry: EvidenceEntry = {
    provider: params.provider,
    model: params.model,
    intent: params.intent,
    latencyMs: params.latencyMs,
    success: params.success,
    errorType: params.errorType,
    fallbackUsed: params.fallbackUsed,
    tokensIn: params.tokensIn,
    tokensOut: params.tokensOut,
    timestamp: Date.now(),
  };

  recordEvidence(entry);
  console.log("[evidence] recorded", {
    provider: entry.provider,
    intent: entry.intent,
    ok: entry.success,
    latency: `${entry.latencyMs}ms`,
  });
}
