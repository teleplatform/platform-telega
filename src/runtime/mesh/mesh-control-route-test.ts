import { routeCapability } from './mesh-capability-router.js';
import { getAllMeshNodes } from './runtime-node-registry.js';
import type { MeshControlRequest, MeshControlResponse } from './mesh-control-types.js';
import { registerMeshControlHandler } from './mesh-control-router.js';

export async function handleRouteTestCommand(request: MeshControlRequest): Promise<MeshControlResponse> {
  const capability = (request.parameters?.capability || request.target) as string;
  if (!capability) {
    return {
      command: 'route_test',
      success: false,
      error: 'capability is required',
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  }

  const nodes = getAllMeshNodes();
  const decision = routeCapability(nodes, {
    capability: capability as any,
    taskType: capability as any,
  });

  return {
    command: 'route_test',
    success: true,
    data: decision,
    executedAt: Date.now(),
    actorId: request.actorId,
  };
}

registerMeshControlHandler({
  command: 'route_test',
  handle: handleRouteTestCommand,
});
