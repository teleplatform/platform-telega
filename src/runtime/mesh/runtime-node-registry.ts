import type { MeshNodeInfo, MeshNodeStatus, MeshNodeKind, MeshNodeCapability, MeshNodeConnection } from './mesh-node-types.js';
import type { RuntimeCapability, TaskType } from '../sigma-forge/sigma-forge-types.js';
import { persistMeshNode, removeMeshNode, loadMeshNodes, loadMeshNode } from './mesh-node-status-store.js';

const nodes = new Map<string, MeshNodeInfo>();
let nodesLoaded = false;

let nodeCounter = 0;

function generateNodeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${String(++nodeCounter).padStart(4, '0')}`;
}

function ensureLoaded(): void {
  if (nodesLoaded) return;
  const stored = loadMeshNodes();
  for (const n of stored) {
    nodes.set(n.id, n);
  }
  nodesLoaded = true;
}

export function registerMeshNode(info: Partial<MeshNodeInfo> & { name: string; address: string }): MeshNodeInfo {
  ensureLoaded();
  const id = info.id || generateNodeId('mn');
  const node: MeshNodeInfo = {
    id,
    name: info.name,
    kind: info.kind || 'worker',
    status: info.status || 'online',
    version: info.version || '1.0.0',
    address: info.address,
    capabilities: info.capabilities || [],
    connections: info.connections || [],
    workerCount: info.workerCount || 0,
    lastSeen: info.lastSeen || Date.now(),
    registeredAt: info.registeredAt || Date.now(),
    metadata: info.metadata || {},
  };
  nodes.set(id, node);
  persistMeshNode(node);
  return node;
}

export function unregisterMeshNode(nodeId: string): boolean {
  ensureLoaded();
  const existed = nodes.delete(nodeId);
  if (existed) removeMeshNode(nodeId);
  return existed;
}

export function getMeshNode(nodeId: string): MeshNodeInfo | undefined {
  ensureLoaded();
  return nodes.get(nodeId);
}

export function getAllMeshNodes(): MeshNodeInfo[] {
  ensureLoaded();
  return [...nodes.values()];
}

export function getOnlineMeshNodes(): MeshNodeInfo[] {
  ensureLoaded();
  return [...nodes.values()].filter(n => n.status === 'online');
}

export function getMeshNodesByCapability(capability: RuntimeCapability): MeshNodeInfo[] {
  ensureLoaded();
  return [...nodes.values()].filter(n =>
    n.status === 'online' && n.capabilities.some(c => c.runtimeCapability === capability)
  );
}

export function getMeshNodesByTaskType(taskType: TaskType): MeshNodeInfo[] {
  ensureLoaded();
  return [...nodes.values()].filter(n =>
    n.status === 'online' && n.capabilities.some(c => c.taskTypes.includes(taskType))
  );
}

export function getMeshNodesByKind(kind: MeshNodeKind): MeshNodeInfo[] {
  ensureLoaded();
  return [...nodes.values()].filter(n => n.kind === kind);
}

export function updateMeshNodeStatus(nodeId: string, status: MeshNodeStatus): boolean {
  ensureLoaded();
  const n = nodes.get(nodeId);
  if (!n) return false;
  n.status = status;
  n.lastSeen = Date.now();
  persistMeshNode(n);
  return true;
}

export function updateMeshNodeHeartbeat(nodeId: string, status: MeshNodeStatus, workerCount: number, activeAssignments: number, memoryUsage: number, uptimeMs: number): boolean {
  ensureLoaded();
  const n = nodes.get(nodeId);
  if (!n) return false;
  n.status = status;
  n.workerCount = workerCount;
  n.lastSeen = Date.now();
  persistMeshNode(n);
  return true;
}

export function addMeshNodeConnection(nodeId: string, connection: MeshNodeConnection): boolean {
  ensureLoaded();
  const n = nodes.get(nodeId);
  if (!n) return false;
  const existing = n.connections.findIndex(c => c.nodeId === connection.nodeId);
  if (existing >= 0) {
    n.connections[existing] = connection;
  } else {
    n.connections.push(connection);
  }
  n.lastSeen = Date.now();
  persistMeshNode(n);
  return true;
}

export function removeMeshNodeConnection(nodeId: string, remoteNodeId: string): boolean {
  ensureLoaded();
  const n = nodes.get(nodeId);
  if (!n) return false;
  n.connections = n.connections.filter(c => c.nodeId !== remoteNodeId);
  persistMeshNode(n);
  return true;
}

export function getMeshNodeCountByStatus(): Record<string, number> {
  ensureLoaded();
  const counts: Record<string, number> = {};
  for (const n of nodes.values()) {
    counts[n.status] = (counts[n.status] || 0) + 1;
  }
  return counts;
}

export function meshNodeRegistrySummary(): string {
  ensureLoaded();
  const all = getAllMeshNodes();
  const counts = getMeshNodeCountByStatus();
  const online = counts['online'] || 0;
  const offline = counts['offline'] || 0;
  const dead = counts['dead'] || 0;
  const totalCaps = all.reduce((s, n) => s + n.capabilities.length, 0);
  const totalConns = all.reduce((s, n) => s + n.connections.length, 0);
  return `Mesh nodes: ${all.length} (online=${online}, offline=${offline}, dead=${dead}, capabilities=${totalCaps}, connections=${totalConns})`;
}

export function reloadMeshNodesFromStore(): void {
  nodes.clear();
  nodesLoaded = false;
  ensureLoaded();
}
