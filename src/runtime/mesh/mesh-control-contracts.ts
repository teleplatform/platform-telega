import { getAllMeshNodes } from './runtime-node-registry.js';
import type { MeshControlRequest, MeshControlResponse } from './mesh-control-types.js';
import { registerMeshControlHandler } from './mesh-control-router.js';

export async function handleContractsCommand(request: MeshControlRequest): Promise<MeshControlResponse> {
  const contractId = request.target || (request.parameters?.contractId as string);

  // Placeholder – in real system this would query the contract fragment store + lineage
  const nodes = getAllMeshNodes();

  const data = contractId
    ? {
        contractId,
        fragments: 0, // would come from store
        verified: 0,
        conflicts: 0,
        participatingNodes: nodes.length,
      }
    : {
        totalContracts: 0,
        totalFragments: 0,
        nodesWithContracts: nodes.length,
      };

  return {
    command: 'contracts',
    success: true,
    data,
    executedAt: Date.now(),
    actorId: request.actorId,
  };
}

registerMeshControlHandler({
  command: 'contracts',
  handle: handleContractsCommand,
});
