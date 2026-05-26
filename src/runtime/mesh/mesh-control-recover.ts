import { runFailoverForDeadNode } from './mesh-failover-runner.js';
import type { MeshControlRequest, MeshControlResponse } from './mesh-control-types.js';
import { registerMeshControlHandler } from './mesh-control-router.js';

export async function handleRecoverCommand(request: MeshControlRequest): Promise<MeshControlResponse> {
  const nodeId = request.target;
  if (!nodeId) {
    return {
      command: 'recover',
      success: false,
      error: 'target (nodeId) is required',
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  }

  try {
    const result = await runFailoverForDeadNode(nodeId);
    return {
      command: 'recover',
      success: true,
      data: result,
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  } catch (err: any) {
    return {
      command: 'recover',
      success: false,
      error: err.message,
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  }
}

registerMeshControlHandler({
  command: 'recover',
  handle: handleRecoverCommand,
});
