import type { SessionProviderId } from "./session/session-registry.js";

export type ExecutionMode = "single" | "multi" | "debate" | "research";
export type ExecutionStatus = "success" | "failed" | "timeout" | "attempted";
export type ErrorCode =
  | "EMPTY_OUTPUT"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "OVERLOAD"
  | "AUTH_REQUIRED"
  | "DOM_SELECTOR_MISS"
  | "EXTRACTION_FAILED"
  | "UNKNOWN";

export interface BridgeEvidence {
  id: string;
  timestamp: number;
  message: string;
  mode: ExecutionMode;
  finalProvider: SessionProviderId;
  providers: Array<{
    provider: SessionProviderId;
    status: ExecutionStatus;
    latencyMs?: number;
    outputChars?: number;
    errorCode?: ErrorCode;
  }>;
  fallbackCount: number;
  totalLatencyMs: number;
  outputLength: number;
}

class BridgeEvidenceStore {
  private evidences: BridgeEvidence[] = [];
  private maxSize = 100;

  add(evidence: BridgeEvidence): void {
    this.evidences.unshift(evidence);
    if (this.evidences.length > this.maxSize) {
      this.evidences.pop();
    }
  }

  getRecent(limit = 10): BridgeEvidence[] {
    return this.evidences.slice(0, limit);
  }

  getFailed(limit = 10): BridgeEvidence[] {
    return this.evidences
      .filter(e => e.providers.some(p => p.status === "failed"))
      .slice(0, limit);
  }

  getByProvider(provider: SessionProviderId, limit = 10): BridgeEvidence[] {
    return this.evidences
      .filter(e => e.finalProvider === provider)
      .slice(0, limit);
  }

  getProviderStats(): Record<SessionProviderId, { attempts: number; success: number; failed: number; avgLatencyMs: number }> {
    const stats: Record<string, { attempts: number; success: number; failed: number; avgLatencyMs: number }> = {};
    
    for (const e of this.evidences) {
      for (const p of e.providers) {
        if (!stats[p.provider]) {
          stats[p.provider] = { attempts: 0, success: 0, failed: 0, avgLatencyMs: 0 };
        }
        stats[p.provider].attempts++;
        if (p.status === "success") stats[p.provider].success++;
        if (p.status === "failed") stats[p.provider].failed++;
        if (p.latencyMs) {
          stats[p.provider].avgLatencyMs = 
            (stats[p.provider].avgLatencyMs * (stats[p.provider].attempts - 1) + p.latencyMs) / stats[p.provider].attempts;
        }
      }
    }
    
    return stats as Record<SessionProviderId, { attempts: number; success: number; failed: number; avgLatencyMs: number }>;
  }

  getEmptyOutputCount(): number {
    return this.evidences.filter(e => e.outputLength === 0).length;
  }

  getRateLimitCount(): number {
    return this.evidences.filter(e => 
      e.providers.some(p => p.errorCode === "RATE_LIMIT" || p.errorCode === "OVERLOAD")
    ).length;
  }

  clear(): void {
    this.evidences = [];
  }
}

export const bridgeEvidenceStore = new BridgeEvidenceStore();

export function addBridgeEvidence(evidence: BridgeEvidence): void {
  bridgeEvidenceStore.add(evidence);
}

export function formatEvidenceSummary(evidence: BridgeEvidence): string {
  const time = new Date(evidence.timestamp).toLocaleTimeString();
  const status = evidence.providers.some(p => p.status === "failed") ? "⚠️" : "✅";
  const providers = evidence.providers.map(p => `${p.provider}:${p.status[0]}`).join(" → ");
  
  return `${status} [${time}] ${evidence.finalProvider} (${evidence.totalLatencyMs}ms) ${evidence.outputLength}chars\n${providers}`;
}

export function formatProviderHealth(): string {
  const stats = bridgeEvidenceStore.getProviderStats();
  const lines: string[] = ["🏥 Provider Health"];
  
  for (const [provider, stat] of Object.entries(stats)) {
    const rate = stat.attempts > 0 ? Math.round((stat.success / stat.attempts) * 100) : 0;
    lines.push(`${provider}: ${stat.success}/${stat.attempts} (${rate}%) avg ${Math.round(stat.avgLatencyMs)}ms`);
  }
  
  const emptyCount = bridgeEvidenceStore.getEmptyOutputCount();
  const rateLimitCount = bridgeEvidenceStore.getRateLimitCount();
  
  if (emptyCount > 0 || rateLimitCount > 0) {
    lines.push(`\n⚠️ Issues: ${emptyCount} empty, ${rateLimitCount} rate-limited`);
  }
  
  return lines.join("\n");
}