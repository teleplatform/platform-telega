import type { AssignmentEnvelope, AssignmentStatus } from './remote-assignment-envelope.js';

export interface AssignmentLineage {
  id: string;
  rootAssignmentId: string;
  parentAssignmentId?: string;
  currentAssignmentId: string;
  taskType: string;
  capability: string;
  nodePath: string[];
  workerPath: string[];
  statusTransitions: StatusTransition[];
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export interface StatusTransition {
  assignmentId: string;
  fromStatus: AssignmentStatus;
  toStatus: AssignmentStatus;
  reason: string;
  timestamp: number;
  nodeId: string;
  workerId?: string;
}

export interface AssignmentDependency {
  dependencyId: string;
  dependencyType: 'parent-child' | 'parallel' | 'sequential' | 'conditional';
  required: boolean;
  status: AssignmentStatus;
  metadata: Record<string, unknown>;
}

export interface AssignmentGraph {
  assignments: Map<string, AssignmentLineage>;
  dependencies: Map<string, AssignmentDependency[]>;
  rootAssignments: string[];
  orphans: string[];
  cycles: string[][];
}

export function createAssignmentLineage(
  assignmentId: string,
  taskType: string,
  capability: string,
  nodeId: string,
  metadata: Record<string, unknown> = {}
): AssignmentLineage {
  const now = Date.now();
  
  return {
    id: `lineage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    rootAssignmentId: assignmentId,
    currentAssignmentId: assignmentId,
    taskType,
    capability,
    nodePath: [nodeId],
    workerPath: [],
    statusTransitions: [{
      assignmentId,
      fromStatus: 'pending' as AssignmentStatus,
      toStatus: 'pending' as AssignmentStatus,
      reason: 'created',
      timestamp: now,
      nodeId,
    }],
    createdAt: now,
    updatedAt: now,
    metadata,
  };
}

export function addNodeToLineage(
  lineage: AssignmentLineage,
  nodeId: string,
  assignmentId: string
): void {
  if (!lineage.nodePath.includes(nodeId)) {
    lineage.nodePath.push(nodeId);
  }
  
  lineage.statusTransitions.push({
    assignmentId,
    fromStatus: lineage.statusTransitions[lineage.statusTransitions.length - 1].toStatus,
    toStatus: 'assigned' as AssignmentStatus,
    reason: 'node reassignment',
    timestamp: Date.now(),
    nodeId,
  });
  
  lineage.currentAssignmentId = assignmentId;
  lineage.updatedAt = Date.now();
}

export function addWorkerToLineage(
  lineage: AssignmentLineage,
  workerId: string,
  assignmentId: string
): void {
  if (!lineage.workerPath.includes(workerId)) {
    lineage.workerPath.push(workerId);
  }
  
  lineage.statusTransitions.push({
    assignmentId,
    fromStatus: lineage.statusTransitions[lineage.statusTransitions.length - 1].toStatus,
    toStatus: 'running' as AssignmentStatus,
    reason: 'worker assignment',
    timestamp: Date.now(),
    nodeId: lineage.nodePath[lineage.nodePath.length - 1],
    workerId,
  });
  
  lineage.currentAssignmentId = assignmentId;
  lineage.updatedAt = Date.now();
}

export function createDependency(
  assignmentId: string,
  dependencyId: string,
  dependencyType: 'parent-child' | 'parallel' | 'sequential' | 'conditional',
  required: boolean = true
): AssignmentDependency {
  return {
    dependencyId,
    dependencyType,
    required,
    status: 'pending' as AssignmentStatus,
    metadata: {},
  };
}

export function buildAssignmentGraph(assignments: AssignmentEnvelope[]): AssignmentGraph {
  const graph: AssignmentGraph = {
    assignments: new Map(),
    dependencies: new Map(),
    rootAssignments: [],
    orphans: [],
    cycles: [],
  };

  // Build lineages from assignments
  for (const assignment of assignments) {
    const lineage = createAssignmentLineage(
      assignment.id,
      assignment.taskType,
      assignment.capability,
      assignment.assignedNodeId,
      assignment.metadata
    );

    graph.assignments.set(assignment.id, lineage);

    // Mark root assignments (no parent)
    if (!assignment.metadata.parentAssignmentId) {
      graph.rootAssignments.push(assignment.id);
    }
  }

  // Detect dependencies based on task/capability patterns
  for (const assignment of assignments) {
    const dependencies: AssignmentDependency[] = [];

    // Find parent-child relationships
    const parentId = assignment.metadata.parentAssignmentId;
    if (parentId && graph.assignments.has(parentId)) {
      dependencies.push(createDependency(
        assignment.id,
        parentId,
        'parent-child',
        true
      ));
    }

    // Find sequential dependencies (same capability, different node)
    const sameCapability = assignments.filter(a => 
      a.capability === assignment.capability && 
      a.id !== assignment.id &&
      a.assignedNodeId !== assignment.assignedNodeId
    );
    
    for (const dep of sameCapability.slice(0, 2)) {
      dependencies.push(createDependency(
        assignment.id,
        dep.id,
        'sequential',
        false
      ));
    }

    if (dependencies.length > 0) {
      graph.dependencies.set(assignment.id, dependencies);
    }
  }

  // Detect orphans (no dependencies and not root)
  for (const [assignmentId, lineage] of graph.assignments) {
    if (!graph.rootAssignments.includes(assignmentId) && !graph.dependencies.has(assignmentId)) {
      graph.orphans.push(assignmentId);
    }
  }

  // TODO: Implement cycle detection

  return graph;
}

export function getAssignmentPath(
  graph: AssignmentGraph,
  assignmentId: string
): string[] {
  const lineage = graph.assignments.get(assignmentId);
  if (!lineage) return [];
  
  return lineage.nodePath;
}

export function getAssignmentStatusHistory(
  graph: AssignmentGraph,
  assignmentId: string
): StatusTransition[] {
  const lineage = graph.assignments.get(assignmentId);
  return lineage ? lineage.statusTransitions : [];
}

export function getAssignmentChain(
  graph: AssignmentGraph,
  rootAssignmentId: string
): AssignmentLineage[] {
  const chain: AssignmentLineage[] = [];
  const visited = new Set<string>();
  
  function traverse(assignmentId: string): void {
    if (visited.has(assignmentId)) return;
    visited.add(assignmentId);
    
    const lineage = graph.assignments.get(assignmentId);
    if (lineage) {
      chain.push(lineage);
      
      const dependencies = graph.dependencies.get(assignmentId);
      if (dependencies) {
        for (const dep of dependencies) {
          traverse(dep.dependencyId);
        }
      }
    }
  }
  
  traverse(rootAssignmentId);
  return chain;
}

export function getGraphStats(graph: AssignmentGraph): {
  totalAssignments: number;
  rootAssignments: number;
  orphans: number;
  dependencies: number;
  longestChain: number;
} {
  const longestChain = Math.max(
    ...Array.from(graph.assignments.values()).map(lineage => lineage.nodePath.length)
  );

  return {
    totalAssignments: graph.assignments.size,
    rootAssignments: graph.rootAssignments.length,
    orphans: graph.orphans.length,
    dependencies: graph.dependencies.size,
    longestChain,
  };
}
