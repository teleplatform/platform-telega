import type { ActionRouteKind } from "../routing/action-route.types.js";
import type { RuntimeTarget } from "../availability/availability.types.js";
import type { CapabilityKind } from "../capability-vnext/capability.types.js";

export interface CapabilityExecutionBinding {
  readonly capability_kind: CapabilityKind;
  readonly execution_route_kind: ActionRouteKind;
  readonly runtime_target?: RuntimeTarget;
  readonly requires_provider: boolean;
}

export class ExecutionBindingRegistry {
  private readonly bindings = new Map<string, CapabilityExecutionBinding>();

  register(binding: Readonly<CapabilityExecutionBinding>): void {
    if (this.bindings.has(binding.capability_kind)) {
      throw new Error(`Binding already registered for capability kind: ${binding.capability_kind}`);
    }
    this.bindings.set(binding.capability_kind, binding);
  }

  resolveByCapabilityKind(kind: CapabilityKind): CapabilityExecutionBinding | undefined {
    return this.bindings.get(kind);
  }

  list(): CapabilityExecutionBinding[] {
    return [...this.bindings.values()];
  }
}
