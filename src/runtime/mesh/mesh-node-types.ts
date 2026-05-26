import type { RuntimeCapability, TaskType } from '../sigma-forge/sigma-forge-types.js';

export type MeshNodeStatus = 'online' | 'offline' | 'degraded' | 'draining' | 'dead';
export type MeshNodeKind = 'primary' | 'worker' | 'edge' | 'relay';

export interface MeshNodeCapability {
  runtimeCapability: RuntimeCapability;
  taskTypes: TaskType[];
  capacity: number;
  currentLoad: number;
}

export interface MeshNodeConnection {
  nodeId: string;
  address: string;
  connectedAt: number;
  lastSeen: number;
  latencyMs: number;
  status: 'active' | 'stale' | 'lost';
}

export interface MeshNodeInfo {
  id: string;
  name: string;
  kind: MeshNodeKind;
  status: MeshNodeStatus;
  version: string;
  address: string;
  capabilities: MeshNodeCapability[];
  connections: MeshNodeConnection[];
  workerCount: number;
  lastSeen: number;
  registeredAt: number;
  metadata: Record<string, unknown>;
}

export interface MeshNodeHeartbeat {
  nodeId: string;
  status: MeshNodeStatus;
  timestamp: number;
  load: number;
  workerCount: number;
  activeAssignments: number;
  memoryUsage: number;
  uptimeMs: number;
}

export interface MeshNodeDiscoveryRequest {
  runtimeId: string;
  name: string;
  version: string;
  address: string;
  capabilities: { runtimeCapability: RuntimeCapability; taskTypes: TaskType[]; capacity: number }[];
  status: MeshNodeStatus;
}

export interface MeshNodeDiscoveryResponse {
  ok: boolean;
  nodeId: string;
  knownNodes: { id: string; name: string; address: string; capabilities: string[]; status: MeshNodeStatus }[];
  error?: string;
}

export interface MeshHealthEntry {
  nodeId: string;
  name: string;
  kind: MeshNodeKind;
  status: MeshNodeStatus;
  address: string;
  lastSeen: number;
  latencyMs: number;
  load: number;
  workerCount: number;
  activeAssignments: number;
  uptimeMs: number;
  lastHeartbeatAt: number | null;
}

export interface MeshHealthMap {
  totalNodes: number;
  online: number;
  offline: number;
  degraded: number;
  draining: number;
  dead: number;
  entries: MeshHealthEntry[];
  generatedAt: string;
  averageLatencyMs: number;
  totalWorkers: number;
  totalAssignments: number;
}
