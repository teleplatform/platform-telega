import type { ContractFragment } from './mesh-contract-envelope.js';

export type ContractFragmentStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'merged'
  | 'conflicted'
  | 'revoked';

export interface StoredContractFragment {
  fragment: ContractFragment;
  status: ContractFragmentStatus;
  storedAt: number;
}

export interface ContractFragmentStore {
  saveContractFragment(fragment: ContractFragment, status?: ContractFragmentStatus): StoredContractFragment;
  getContractFragment(fragmentId: string): StoredContractFragment | undefined;
  getFragmentsByContract(contractId: string): StoredContractFragment[];
  getFragmentsByNode(nodeId: string): StoredContractFragment[];
  listContractFragments(status?: ContractFragmentStatus): StoredContractFragment[];
  markFragmentStatus(fragmentId: string, status: ContractFragmentStatus): boolean;
  clearContractFragments(): void;
}

export class InMemoryContractFragmentStore implements ContractFragmentStore {
  private fragments = new Map<string, StoredContractFragment>();

  saveContractFragment(fragment: ContractFragment, status: ContractFragmentStatus = 'pending'): StoredContractFragment {
    const stored: StoredContractFragment = {
      fragment,
      status,
      storedAt: Date.now(),
    };
    this.fragments.set(fragment.fragmentId, stored);
    return stored;
  }

  getContractFragment(fragmentId: string): StoredContractFragment | undefined {
    return this.fragments.get(fragmentId);
  }

  getFragmentsByContract(contractId: string): StoredContractFragment[] {
    return Array.from(this.fragments.values()).filter(s =>
      s.fragment.metadata?.contractId === contractId
    );
  }

  getFragmentsByNode(nodeId: string): StoredContractFragment[] {
    return Array.from(this.fragments.values()).filter(s => s.fragment.nodeId === nodeId);
  }

  listContractFragments(status?: ContractFragmentStatus): StoredContractFragment[] {
    const all = Array.from(this.fragments.values());
    if (status) {
      return all.filter(s => s.status === status);
    }
    return all;
  }

  markFragmentStatus(fragmentId: string, status: ContractFragmentStatus): boolean {
    const stored = this.fragments.get(fragmentId);
    if (!stored) return false;
    stored.status = status;
    return true;
  }

  clearContractFragments(): void {
    this.fragments.clear();
  }
}
