import type { ContractFragment } from './mesh-contract-envelope.js';

export type BindingStatus =
  | 'pending'
  | 'bound'
  | 'verified'
  | 'conflicted'
  | 'revoked';

export interface RemoteContractBinding {
  bindingId: string;
  contractId: string;
  fragmentId: string;
  nodeId: string;
  status: BindingStatus;
  boundAt: number;
  verifiedAt?: number;
  signature?: string;
  metadata: Record<string, unknown>;
}

export interface RemoteContractBindingStore {
  bindRemoteContract(fragment: ContractFragment, nodeId: string): RemoteContractBinding;
  unbindRemoteContract(bindingId: string): boolean;
  getBindingsByContract(contractId: string): RemoteContractBinding[];
  getBindingsByNode(nodeId: string): RemoteContractBinding[];
  markBindingVerified(bindingId: string, signature?: string): boolean;
  markBindingConflicted(bindingId: string): boolean;
  clearBindings(): void;
}

export class InMemoryRemoteContractBindingStore implements RemoteContractBindingStore {
  private bindings = new Map<string, RemoteContractBinding>();

  bindRemoteContract(fragment: ContractFragment, nodeId: string): RemoteContractBinding {
    const bindingId = `binding_${fragment.fragmentId}_${nodeId}_${Date.now()}`;

    const binding: RemoteContractBinding = {
      bindingId,
      contractId: fragment.metadata?.contractId || 'unknown',
      fragmentId: fragment.fragmentId,
      nodeId,
      status: 'bound',
      boundAt: Date.now(),
      metadata: {
        sourceNodeId: fragment.metadata?.sourceNodeId,
      },
    };

    this.bindings.set(bindingId, binding);
    return binding;
  }

  unbindRemoteContract(bindingId: string): boolean {
    return this.bindings.delete(bindingId);
  }

  getBindingsByContract(contractId: string): RemoteContractBinding[] {
    return Array.from(this.bindings.values()).filter(b => b.contractId === contractId);
  }

  getBindingsByNode(nodeId: string): RemoteContractBinding[] {
    return Array.from(this.bindings.values()).filter(b => b.nodeId === nodeId);
  }

  markBindingVerified(bindingId: string, signature?: string): boolean {
    const binding = this.bindings.get(bindingId);
    if (!binding) return false;

    binding.status = 'verified';
    binding.verifiedAt = Date.now();
    if (signature) binding.signature = signature;

    return true;
  }

  markBindingConflicted(bindingId: string): boolean {
    const binding = this.bindings.get(bindingId);
    if (!binding) return false;

    binding.status = 'conflicted';
    return true;
  }

  clearBindings(): void {
    this.bindings.clear();
  }
}
