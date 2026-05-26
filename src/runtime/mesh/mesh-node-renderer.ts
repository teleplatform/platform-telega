import type { MeshNodeInfo, MeshNodeStatus } from './mesh-node-types.js';

export function renderNodeStatusBadge(status: MeshNodeStatus): string {
  const badges: Record<MeshNodeStatus, string> = {
    online: '🟢 online',
    degraded: '🟡 degraded',
    dead: '🔴 dead',
    draining: '🟠 draining',
    offline: '⚫ offline',
  };
  return badges[status] || status;
}

export function renderNodeCompact(node: MeshNodeInfo): string {
  const status = renderNodeStatusBadge(node.status);
  const load = node.capabilities.reduce((sum, c) => sum + c.currentLoad, 0);
  const capCount = node.capabilities.length;
  return `${node.name} [${node.kind}] ${status} | workers=${node.workerCount} | caps=${capCount} | load=${load}`;
}

export function renderNodeDetails(node: MeshNodeInfo): string {
  const lines: string[] = [];
  lines.push(`Node: ${node.name} (${node.id})`);
  lines.push(`Status: ${renderNodeStatusBadge(node.status)}`);
  lines.push(`Kind: ${node.kind}`);
  lines.push(`Address: ${node.address}`);
  lines.push(`Workers: ${node.workerCount}`);
  lines.push(`Last seen: ${new Date(node.lastSeen).toISOString()}`);

  if (node.capabilities.length > 0) {
    lines.push('Capabilities:');
    node.capabilities.forEach(cap => {
      lines.push(`  - ${cap.runtimeCapability} (load ${cap.currentLoad}/${cap.capacity})`);
    });
  }

  return lines.join('\n');
}

export function renderMeshNodes(nodes: MeshNodeInfo[]): string {
  if (nodes.length === 0) return 'No nodes registered.';

  return nodes
    .map(n => renderNodeCompact(n))
    .join('\n');
}
