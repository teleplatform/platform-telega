import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { ProviderConnectivityStatus } from "./provider-connectivity.types.js";

interface HealthEntry {
  provider_id: string;
  status: ProviderConnectivityStatus;
  latency_ms?: number;
  last_checked: string;
}

export class ProviderHealthStore {
  private entries = new Map<string, HealthEntry>();

  update(providerId: string, status: ProviderConnectivityStatus, latencyMs?: number): void {
    const entry: HealthEntry = {
      provider_id: providerId,
      status,
      latency_ms: latencyMs,
      last_checked: new Date().toISOString(),
    };

    this.entries.set(providerId, entry);

    appendEvidenceRecord({
      evidence_id: hashTraceId(providerId, "provider_health_updated"),
      trace_id: providerId,
      job_id: "provider",
      type: "provider_health_updated" as any,
      timestamp: entry.last_checked,
      payload: {
        provider_id: providerId,
        status,
        latency_ms: latencyMs,
      },
    });
  }

  get(providerId: string): HealthEntry | undefined {
    return this.entries.get(providerId);
  }

  getStatus(providerId: string): ProviderConnectivityStatus | undefined {
    return this.entries.get(providerId)?.status;
  }

  getAll(): HealthEntry[] {
    return [...this.entries.values()];
  }

  isHealthy(providerId: string): boolean {
    const entry = this.entries.get(providerId);
    return entry?.status === "healthy";
  }

  clear(): void {
    this.entries.clear();
  }
}
