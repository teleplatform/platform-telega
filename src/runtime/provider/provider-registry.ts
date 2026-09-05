import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import type { ProviderProfile } from "./provider-profile.js";

export class ProviderRegistry {
  private providers = new Map<string, ProviderProfile>();

  register(profile: ProviderProfile): void {
    this.providers.set(profile.provider_id, profile);

    appendEvidenceRecord({
      evidence_id: hashTraceId(profile.provider_id, "provider_registry_loaded"),
      trace_id: profile.provider_id,
      job_id: "provider",
      type: "provider_registry_loaded" as any,
      timestamp: new Date().toISOString(),
      payload: {
        provider_id: profile.provider_id,
        kind: profile.kind,
        display_name: profile.display_name,
        strengths: profile.strengths,
      },
    });
  }

  get(providerId: string): ProviderProfile | undefined {
    return this.providers.get(providerId);
  }

  list(): ProviderProfile[] {
    return [...this.providers.values()];
  }

  listEnabled(): ProviderProfile[] {
    return this.list().filter((p) => p.enabled);
  }

  disable(providerId: string): void {
    const p = this.providers.get(providerId);
    if (p) p.enabled = false;
  }

  enable(providerId: string): void {
    const p = this.providers.get(providerId);
    if (p) p.enabled = true;
  }

  findByStrength(strength: ProviderProfile["strengths"][number]): ProviderProfile[] {
    return this.listEnabled().filter((p) => p.strengths.includes(strength));
  }
}
