import { buildMeshHealthMap } from './mesh-health-map.js';
import type { MeshControlRequest, MeshControlResponse } from './mesh-control-types.js';
import { registerMeshControlHandler } from './mesh-control-router.js';

export async function handleHealthCommand(request: MeshControlRequest): Promise<MeshControlResponse> {
  const healthMap = buildMeshHealthMap();

  return {
    command: 'health',
    success: true,
    data: {
      healthScore: healthMap.online / Math.max(1, healthMap.totalNodes) * 100,
      ...healthMap,
    },
    executedAt: Date.now(),
    actorId: request.actorId,
  };
}

registerMeshControlHandler({
  command: 'health',
  handle: handleHealthCommand,
});
