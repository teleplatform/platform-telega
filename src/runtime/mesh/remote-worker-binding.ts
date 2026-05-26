import type { MeshNodeInfo, MeshNodeKind } from './mesh-node-types.js';
import type { AssignmentEnvelope, RemoteAssignmentRequest, AssignmentStatus } from './remote-assignment-envelope.js';

export interface WorkerBinding {
  assignmentId: string;
  nodeId: string;
  workerId: string;
  taskId: string;
  taskType: string;
  capability: string;
  bindingType: 'local' | 'remote';
  bindingStatus: 'active' | 'inactive' | 'expired' | 'broken';
  boundAt: number;
  expiresAt: number;
  metadata: Record<string, unknown>;
}

export interface WorkerBindingRequest {
  assignmentId: string;
  targetNodeId: string;
  targetWorkerId?: string;
  taskId: string;
  taskType: string;
  capability: string;
  bindingType: 'local' | 'remote';
  durationMs: number;
  priority: 'low' | 'normal' | 'high';
  metadata?: Record<string, unknown>;
}

export interface WorkerBindingResponse {
  ok: boolean;
  bindingId: string;
  workerId: string;
  nodeId: string;
  assignedAt: number;
  expiresAt: number;
  error?: string;
}

export interface WorkerBindingStats {
  total: number;
  active: number;
  inactive: number;
  expired: number;
  broken: number;
  averageBindingDuration: number;
  nodeDistribution: Record<string, number>;
  workerTypeDistribution: Record<string, number>;
}

export interface WorkerAvailability {
  nodeId: string;
  workerId: string;
  taskTypes: string[];
  capabilities: string[];
  currentLoad: number;
  maxCapacity: number;
  isAvailable: boolean;
  estimatedWaitTimeMs: number;
  lastUsedAt: number;
}

export function createWorkerBinding(
  request: WorkerBindingRequest,
  nodeId: string
): WorkerBinding {
  const bindingId = `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  const expiresAt = now + request.durationMs;

  return {
    assignmentId: request.assignmentId,
    nodeId,
    workerId: request.targetWorkerId || 'auto-select',
    taskId: request.taskId,
    taskType: request.taskType,
    capability: request.capability,
    bindingType: request.bindingType,
    bindingStatus: 'active',
    boundAt: now,
    expiresAt,
    metadata: request.metadata || {},
  };
}

export function checkWorkerAvailability(
  node: MeshNodeInfo,
  taskType: string,
  capability: string,
  requiredCapacity: number = 1
): WorkerAvailability {
  const matchingCapabilities = node.capabilities.filter(c => 
    c.runtimeCapability === capability && 
    c.taskTypes.includes(taskType as any)
  );

  if (matchingCapabilities.length === 0) {
    return {
      nodeId: node.id,
      workerId: '',
      taskTypes: [],
      capabilities: [],
      currentLoad: 0,
      maxCapacity: 0,
      isAvailable: false,
      estimatedWaitTimeMs: 0,
      lastUsedAt: 0,
    };
  }

  const totalCapacity = matchingCapabilities.reduce((sum, c) => sum + c.capacity, 0);
  const totalLoad = matchingCapabilities.reduce((sum, c) => sum + c.currentLoad, 0);
  const availableCapacity = totalCapacity - totalLoad;

  const nodeWorkers = node.workerCount || 0;
  const activeAssignments = node.activeAssignments || 0;
  
  const isAvailable = node.status === 'online' && 
                     availableCapacity >= requiredCapacity &&
                     nodeWorkers > 0;

  const estimatedWaitTimeMs = isAvailable ? 0 : 
    Math.max(0, (activeAssignments - nodeWorkers) * 5000);

  return {
    nodeId: node.id,
    workerId: 'auto-select',
    taskTypes: [taskType],
    capabilities: [capability],
    currentLoad: totalLoad,
    maxCapacity: totalCapacity,
    isAvailable,
    estimatedWaitTimeMs,
    lastUsedAt: node.lastSeen,
  };
}

export function findBestWorkerForCapability(
  nodes: MeshNodeInfo[],
  taskType: string,
  capability: string,
  requiredCapacity: number = 1
): { node: MeshNodeInfo; workerId: string; score: number } | null {
  const candidates = nodes
    .filter(node => node.status === 'online')
    .map(node => {
      const availability = checkWorkerAvailability(node, taskType, capability, requiredCapacity);
      
      if (!availability.isAvailable) {
        return null;
      }

      const loadFactor = availability.maxCapacity > 0
        ? 1 - (availability.currentLoad / availability.maxCapacity)
        : 0;

      const latencyScore = Math.min(100, 1000 / (availability.estimatedWaitTimeMs + 1));
      const healthScore = node.status === 'online' ? 100 : 50;

      const totalScore = loadFactor * 0.4 + latencyScore * 0.3 + healthScore * 0.3;

      return {
        node,
        workerId: availability.workerId,
        score: Math.round(totalScore * 100) / 100,
      };
    })
    .filter((candidate): candidate is { node: MeshNodeInfo; workerId: string; score: number } => 
      candidate !== null
    );

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0];
}

export function createWorkerBindingRequest(
  assignment: AssignmentEnvelope,
  targetNodeId: string,
  targetWorkerId?: string
): WorkerBindingRequest {
  return {
    assignmentId: assignment.id,
    targetNodeId,
    targetWorkerId,
    taskId: assignment.taskId,
    taskType: assignment.taskType,
    capability: assignment.capability,
    bindingType: targetNodeId === assignment.assignedNodeId ? 'local' : 'remote',
    durationMs: assignment.expiresAt - Date.now(),
    priority: assignment.metadata.priority || 'normal',
    metadata: assignment.metadata,
  };
}

export function getWorkerBindingStats(bindings: WorkerBinding[]): WorkerBindingStats {
  const stats: WorkerBindingStats = {
    total: bindings.length,
    active: 0,
    inactive: 0,
    expired: 0,
    broken: 0,
    averageBindingDuration: 0,
    nodeDistribution: {},
    workerTypeDistribution: {},
  };

  let totalDuration = 0;
  let durationCount = 0;
  const now = Date.now();

  for (const binding of bindings) {
    // Count by status
    if (binding.bindingStatus === 'active') stats.active++;
    else if (binding.bindingStatus === 'inactive') stats.inactive++;
    else if (binding.bindingStatus === 'expired') stats.expired++;
    else if (binding.bindingStatus === 'broken') stats.broken++;

    // Count by node
    stats.nodeDistribution[binding.nodeId] = (stats.nodeDistribution[binding.nodeId] || 0) + 1;

    // Count by binding type
    const typeKey = binding.bindingType;
    stats.workerTypeDistribution[typeKey] = (stats.workerTypeDistribution[typeKey] || 0) + 1;

    // Calculate duration
    const duration = now - binding.boundAt;
    totalDuration += duration;
    durationCount++;
  }

  stats.averageBindingDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

  return stats;
}

export function checkBindingConflicts(
  bindings: WorkerBinding[],
  newBinding: WorkerBinding
): boolean {
  const now = Date.now();
  
  // Check for active bindings on the same worker for the same task
  const conflictingBindings = bindings.filter(binding =>
    binding.nodeId === newBinding.nodeId &&
    binding.workerId === newBinding.workerId &&
    binding.taskId === newBinding.taskId &&
    binding.bindingStatus === 'active' &&
    binding.expiresAt > now
  );

  return conflictingBindings.length > 0;
}

export function findAvailableWorkers(
  nodes: MeshNodeInfo[],
  taskType: string,
  capability: string
): WorkerAvailability[] {
  const allAvailabilities: WorkerAvailability[] = [];

  for (const node of nodes) {
    const availability = checkWorkerAvailability(node, taskType, capability);
    if (availability.isAvailable) {
      allAvailabilities.push(availability);
    }
  }

  return allAvailabilities.sort((a, b) => {
    // Sort by availability (true first), then by estimated wait time
    if (a.isAvailable && !b.isAvailable) return -1;
    if (!a.isAvailable && b.isAvailable) return 1;
    return a.estimatedWaitTimeMs - b.estimatedWaitTimeMs;
  });
}
