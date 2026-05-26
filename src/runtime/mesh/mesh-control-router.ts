import type { MeshControlRequest, MeshControlResponse, MeshControlHandler } from './mesh-control-types.js';

const handlers = new Map<MeshControlHandler['command'], MeshControlHandler>();

export function registerMeshControlHandler(handler: MeshControlHandler): void {
  handlers.set(handler.command, handler);
}

export async function dispatchMeshControlCommand(
  request: MeshControlRequest
): Promise<MeshControlResponse> {
  const handler = handlers.get(request.command);

  if (!handler) {
    return {
      command: request.command,
      success: false,
      error: `Unknown command: ${request.command}`,
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  }

  try {
    return await handler.handle(request);
  } catch (err: any) {
    return {
      command: request.command,
      success: false,
      error: err.message || 'Handler execution failed',
      executedAt: Date.now(),
      actorId: request.actorId,
    };
  }
}

export function getRegisteredMeshControlCommands(): string[] {
  return Array.from(handlers.keys());
}

export function clearMeshControlHandlers(): void {
  handlers.clear();
}
