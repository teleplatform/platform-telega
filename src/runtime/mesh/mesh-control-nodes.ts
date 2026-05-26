import { getAllMeshNodes, getMeshNode } from './runtime-node-registry.js';
import type { MeshControlRequest, MeshControlResponse } from './mesh-control-types.js';
import { registerMeshControlHandler } from './mesh-control-router.js';

export async function handleNodesCommand(request: MeshControlRequest): Promise<MeshControlResponse> {
  const target = request.target;

  if (target) {
    const node = getMeshNode(target);
    return {
      command: 'nodes',
      success: !!node,
      data: node ? { node } : null,
      error: node ? undefined : `Node ${target} not found`,
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  }

  const nodes = getAllMeshNodes();
  return {
    command: 'nodes',
    success: true,
    data: {
      total: nodes.length,
      nodes: nodes.map(n => ({
        id: n.id,
        name: n.name,
        kind: n.kind,
        status: n.status,
        workerCount: n.workerCount,
        capabilities: n.capabilities.map(c => c.runtimeCapability),
      })),
    },
    executedAt: Date.now(),
    actorId: request.actorId,
  };
}

registerMeshControlHandler({
  command: 'nodes',
  handle: handleNodesCommand,
});
