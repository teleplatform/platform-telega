export type ContractStatus = 'draft' | 'active' | 'verified' | 'merged' | 'conflicted' | 'revoked';

export interface ContractFragment {
  nodeId: string;
  fragmentId: string;
  payload: Record<string, unknown>;
  signature: string;
  timestamp: number;
  version: number;

  metadata?: {
    contractId?: string;
    parentFragmentId?: string;
    sourceNodeId?: string;
    tags?: string[];
  };
}

export interface RuntimeContract {
  id: string;
  name: string;
  version: number;
  status: ContractStatus;
  rootNodeId: string;
  fragments: ContractFragment[];
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export interface ContractEnvelope {
  contract: RuntimeContract;
  sourceNodeId: string;
  targetNodeId?: string;
  signature: string;
  timestamp: number;
}

export function createContractEnvelope(
  contract: RuntimeContract,
  sourceNodeId: string,
  signature: string
): ContractEnvelope {
  return {
    contract,
    sourceNodeId,
    signature,
    timestamp: Date.now(),
  };
}

export function createContractFragment(
  nodeId: string,
  payload: Record<string, unknown>,
  signature: string,
  version = 1
): ContractFragment {
  return {
    nodeId,
    fragmentId: `frag_${nodeId}_${Date.now()}`,
    payload,
    signature,
    timestamp: Date.now(),
    version,
    metadata: {
      sourceNodeId: nodeId,
    },
  };
}

export function addFragmentToContract(
  contract: RuntimeContract,
  fragment: ContractFragment
): RuntimeContract {
  return {
    ...contract,
    fragments: [...contract.fragments, fragment],
    updatedAt: Date.now(),
  };
}
