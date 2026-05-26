import type { MeshControlRequest, MeshControlCommand } from './mesh-control-types.js';

const COMMAND_MAP: Record<string, MeshControlCommand> = {
  '/control_mesh_nodes': 'nodes',
  '/control_mesh_health': 'health',
  '/control_mesh_drain_node': 'drain_node',
  '/control_mesh_recover': 'recover',
  '/control_mesh_route_test': 'route_test',
  '/control_mesh_sync_evidence': 'sync_evidence',
  '/control_mesh_contracts': 'contracts',
};

export function parseMeshControlCommand(
  raw: string,
  actorId: string
): MeshControlRequest | null {
  const trimmed = raw.trim();
  const parts = trimmed.split(/\s+/);
  const cmd = parts[0] as keyof typeof COMMAND_MAP;

  const command = COMMAND_MAP[cmd];
  if (!command) return null;

  const target = parts[1];
  const parameters: Record<string, unknown> = {};

  // Simple key=value parsing for extra args
  for (let i = 2; i < parts.length; i++) {
    const [k, v] = parts[i].split('=');
    if (k && v) parameters[k] = v;
  }

  return {
    command,
    actorId,
    target,
    parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
    timestamp: Date.now(),
  };
}

export function formatMeshControlResponse(response: any): string {
  if (!response.success) {
    return `❌ ${response.command}: ${response.error}`;
  }

  const data = response.data;
  if (typeof data === 'string') return `✅ ${response.command}\n${data}`;
  if (data && typeof data === 'object') {
    return `✅ ${response.command}\n${JSON.stringify(data, null, 2)}`;
  }
  return `✅ ${response.command} executed successfully`;
}

export function registerDefaultMeshControlHandlers(): void {
  // Handlers are auto-registered when their modules are imported.
  // This function exists for explicit initialization if needed.
}
