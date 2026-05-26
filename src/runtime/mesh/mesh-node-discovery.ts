import type { MeshNodeInfo, MeshNodeCapability, MeshNodeStatus, MeshNodeDiscoveryRequest, MeshNodeDiscoveryResponse } from './mesh-node-types.js';
import { registerMeshNode, getMeshNode, getAllMeshNodes } from './runtime-node-registry.js';
import { generateAuthToken } from '../workers/worker-auth.js';

export interface DiscoveryConfig {
  runtimeId: string;
  name: string;
  version: string;
  address: string;
  capabilities: { runtimeCapability: string; taskTypes: string[]; capacity: number }[];
  authToken: string;
}

let discoveryConfig: DiscoveryConfig | null = null;

export function setDiscoveryConfig(config: DiscoveryConfig): void {
  discoveryConfig = config;
}

export function getDiscoveryConfig(): DiscoveryConfig | null {
  return discoveryConfig;
}

export async function discoverMeshNode(remoteAddress: string, remoteAuthToken?: string): Promise<{ node: MeshNodeInfo | null; error?: string }> {
  const config = discoveryConfig;
  if (!config) {
    return { node: null, error: 'Discovery not configured: call setDiscoveryConfig first' };
  }

  const request: MeshNodeDiscoveryRequest = {
    runtimeId: config.runtimeId,
    name: config.name,
    version: config.version,
    address: config.address,
    capabilities: config.capabilities.map(c => ({
      runtimeCapability: c.runtimeCapability as any,
      taskTypes: c.taskTypes as any[],
      capacity: c.capacity,
    })),
    status: 'online',
  };

  const token = remoteAuthToken || config.authToken;
  const authHeader = `Bearer ${generateAuthToken({ ...request, _ts: Date.now() })}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const url = `${remoteAddress.replace(/\/$/, '')}/mesh/v1/discover`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'X-Runtime-Id': config.runtimeId,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { node: null, error: `Discovery HTTP ${response.status}` };
    }

    const data: MeshNodeDiscoveryResponse = await response.json();
    if (!data.ok) {
      return { node: null, error: data.error || 'Discovery rejected' };
    }

    if (data.knownNodes) {
      for (const known of data.knownNodes) {
        const existing = getMeshNode(known.id);
        if (!existing) {
          registerMeshNode({
            id: known.id,
            name: known.name,
            kind: 'worker',
            status: known.status,
            version: 'unknown',
            address: known.address,
            capabilities: known.capabilities.map(c => ({
              runtimeCapability: c as any,
              taskTypes: [],
              capacity: 1,
              currentLoad: 0,
            })),
            connections: [],
            workerCount: 0,
            lastSeen: Date.now(),
            registeredAt: Date.now(),
            metadata: {},
          });
        }
      }
    }

    const node = getMeshNode(data.nodeId);
    if (node) {
      return { node };
    }

    return { node: null, error: 'Node registered but not found in local registry' };
  } catch (err: any) {
    return { node: null, error: `Discovery failed: ${err.message}` };
  }
}

export function handleMeshNodeDiscovery(request: MeshNodeDiscoveryRequest): MeshNodeDiscoveryResponse {
  const config = discoveryConfig;
  if (!config) {
    return { ok: false, nodeId: '', knownNodes: [], error: 'Discovery not configured on this runtime' };
  }

  const existing = getMeshNode(request.runtimeId);
  if (!existing) {
    registerMeshNode({
      id: request.runtimeId,
      name: request.name,
      kind: 'worker',
      status: request.status,
      version: request.version,
      address: request.address,
      capabilities: request.capabilities.map(c => ({
        runtimeCapability: c.runtimeCapability,
        taskTypes: c.taskTypes,
        capacity: c.capacity,
        currentLoad: 0,
      })),
      connections: [],
      workerCount: 0,
      lastSeen: Date.now(),
      registeredAt: Date.now(),
      metadata: {},
    });
  }

  const allNodes = getAllMeshNodes();
  const knownNodes = allNodes
    .filter(n => n.id !== request.runtimeId)
    .map(n => ({
      id: n.id,
      name: n.name,
      address: n.address,
      capabilities: n.capabilities.map(c => c.runtimeCapability),
      status: n.status,
    }));

  return {
    ok: true,
    nodeId: config.runtimeId,
    knownNodes,
  };
}

export function getDiscoveryUrl(node: MeshNodeInfo): string {
  return `${node.address.replace(/\/$/, '')}/mesh/v1/discover`;
}
