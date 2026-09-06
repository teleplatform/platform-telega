import type { CapabilityDescriptor } from "./capability-descriptor.js";
import type { CapabilityKind } from "./capability.types.js";

export class CapabilityRegistry {
  private readonly capabilities = new Map<string, CapabilityDescriptor>();

  register(capability: Readonly<CapabilityDescriptor>): void {
    if (this.capabilities.has(capability.capability_id)) {
      throw new Error(`Capability already registered: ${capability.capability_id}`);
    }
    this.capabilities.set(capability.capability_id, capability);
  }

  resolve(kind: CapabilityKind): CapabilityDescriptor {
    const matches = [...this.capabilities.values()].filter(
      (descriptor) => descriptor.kind === kind,
    );
    if (matches.length === 0) {
      throw new Error(`No capability registered for kind: ${kind}`);
    }
    if (matches.length > 1) {
      throw new Error(`Ambiguous capability kind, multiple descriptors for: ${kind}`);
    }
    return matches[0];
  }

  resolveById(capabilityId: string): CapabilityDescriptor {
    const descriptor = this.capabilities.get(capabilityId);
    if (!descriptor) {
      throw new Error(`Unknown capability: ${capabilityId}`);
    }
    return descriptor;
  }

  has(capabilityId: string): boolean {
    return this.capabilities.has(capabilityId);
  }

  list(): CapabilityDescriptor[] {
    return [...this.capabilities.values()];
  }
}
