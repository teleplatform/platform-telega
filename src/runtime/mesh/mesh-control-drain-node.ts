import { updateMeshNodeStatus, getMeshNode } from './runtime-node-registry.js';
import type { MeshControlRequest, MeshControlResponse } from './mesh-control-types.js';
import { registerMeshControlHandler } from './mesh-control-router.js';

export async function handleDrainNodeCommand(request: MeshControlRequest): Promise<MeshControlResponse> {
  const nodeId = request.target;
  if (!nodeId) {
    return {
      command: 'drain_node',
      success: false,
      error: 'target (nodeId) is required',
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  }

  const node = getMeshNode(nodeId);
  if (!node) {
    return {
      command: 'drain_node',
      success: false,
      error: `Node ${nodeId} not found`,
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  }

  updateMeshNodeStatus(nodeId, 'draining');

  // Safe access – full integration with assignment store will be done in later increment
  let activeAssignments = 0;
  try {
    const mod = await import('./cross-node-assignment-store.js');
    if (typeof mod.getAssignments === 'function') {
      const assignments = mod.getAssignments({ nodeId });
      activeAssignments = Array.isArray(assignments) ? assignments.length : (assignments?.length || 0);
    }
  } catch {
    // ignore – store not fully exported yet
  }

  return {
    command: 'drain_node',
    success: true,
    data: {
      nodeId,
      status: 'draining',
      activeAssignments,
    },
    executedAt: Date.now(),
    actorId: request.actorId,
  };
}

registerMeshControlHandler({
  command: 'drain_node',
  handle: handleDrainNodeCommand,
});
