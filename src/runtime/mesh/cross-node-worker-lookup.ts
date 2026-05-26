import type { MeshNodeInfo, MeshNodeKind } from './mesh-node-types.js';

export interface WorkerLookupResult {
  nodeId: string;
  nodeName: string;
  workerCount: number;
  activeAssignments: number;
  address: string;
  hasCapability: boolean;
  capabilityMatch: string[];
}

export interface WorkerLookupRequest {
  capability?: string;
  taskType?: string;
  maxResults?: number;
  excludeNodeIds?: string[];
}

export function lookupWorkers(
  nodes: MeshNodeInfo[],
  request: WorkerLookupRequest = {}
): WorkerLookupResult[] {
  const { capability, taskType, maxResults = 10, excludeNodeIds = [] } = request;

  const results: WorkerLookupResult[] = nodes
    .filter(n => n.status === 'online' && n.workerCount > 0)
    .filter(n => !excludeNodeIds.includes(n.id))
    .map(node => {
      const matchingCaps = node.capabilities.filter(c => {
        const capMatch = !capability || c.runtimeCapability === capability;
        const taskMatch = !taskType || c.taskTypes.includes(taskType as any);
        return capMatch && taskMatch;
      });

      return {
        nodeId: node.id,
        nodeName: node.name,
        workerCount: node.workerCount,
        activeAssignments: node.activeAssignments || 0,
        address: node.address,
        hasCapability: matchingCaps.length > 0,
        capabilityMatch: matchingCaps.map(c => c.runtimeCapability),
      };
    })
    .filter(r => !capability || r.hasCapability)
    .sort((a, b) => {
      // Sort by available capacity (workers - active assignments)
      const aAvail = a.workerCount - a.activeAssignments;
      const bAvail = b.workerCount - b.activeAssignments;
      return bAvail - aAvail;
    });

  if (maxResults > 0) {
    return results.slice(0, maxResults);
  }
  return results;
}

export function lookupWorkersByKind(
  nodes: MeshNodeInfo[],
  kind: MeshNodeKind,
  request?: WorkerLookupRequest
): WorkerLookupResult[] {
  const filtered = nodes.filter(n => n.kind === kind);
  return lookupWorkers(filtered, request);
}

export function getWorkerSummary(nodes: MeshNodeInfo[]): {
  totalWorkers: number;
  totalActiveAssignments: number;
  totalAvailable: number;
  nodesWithWorkers: number;
} {
  const nodesWithWorkers = nodes.filter(n => n.workerCount > 0 && n.status === 'online');
  const totalWorkers = nodesWithWorkers.reduce((s, n) => s + n.workerCount, 0);
  const totalActive = nodesWithWorkers.reduce((s, n) => s + (n.activeAssignments || 0), 0);

  return {
    totalWorkers,
    totalActiveAssignments: totalActive,
    totalAvailable: totalWorkers - totalActive,
    nodesWithWorkers: nodesWithWorkers.length,
  };
}
