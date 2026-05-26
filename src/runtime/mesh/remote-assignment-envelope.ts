import type { MeshNodeInfo } from './mesh-node-types.js';

export interface AssignmentEnvelope {
  id: string;
  taskId: string;
  taskType: string;
  capability: string;
  assignedNodeId: string;
  assignedWorkerId: string;
  assignedAt: number;
  expiresAt: number;
  status: AssignmentStatus;
  payload: any;
  retryCount: number;
  metadata: Record<string, unknown>;
}

export interface RemoteAssignmentRequest {
  taskId: string;
  taskType: string;
  capability: string;
  targetNodeId: string;
  targetWorkerId?: string;
  payload: any;
  timeoutMs: number;
  priority: 'low' | 'normal' | 'high';
  retryPolicy?: {
    maxRetries: number;
    delayMs: number;
    exponentialBackoff: boolean;
  };
}

export interface RemoteAssignmentResponse {
  ok: boolean;
  assignmentId: string;
  assignedAt: number;
  estimatedDuration: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export type AssignmentStatus =
  | 'pending'
  | 'assigned'
  | 'running'
  | 'completed'
  | 'failed'
  | 'timed_out'
  | 'cancelled'
  | 'reassigned';

export interface AssignmentFilter {
  taskId?: string;
  nodeId?: string;
  workerId?: string;
  status?: AssignmentStatus;
  capability?: string;
  taskType?: string;
  since?: number;
  until?: number;
}

export interface AssignmentStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  timed_out: number;
  cancelled: number;
  reassigned: number;
  averageDurationMs: number;
  successRate: number;
}

export function createAssignmentEnvelope(
  request: RemoteAssignmentRequest,
  nodeId: string
): AssignmentEnvelope {
  const assignmentId = `assignment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  const expiresAt = now + request.timeoutMs;

  return {
    id: assignmentId,
    taskId: request.taskId,
    taskType: request.taskType,
    capability: request.capability,
    assignedNodeId: nodeId,
    assignedWorkerId: request.targetWorkerId || 'auto-select',
    assignedAt: now,
    expiresAt,
    status: 'pending',
    payload: request.payload,
    retryCount: 0,
    metadata: {
      priority: request.priority,
      retryPolicy: request.retryPolicy,
      targetNodeId: request.targetNodeId,
      targetWorkerId: request.targetWorkerId,
    },
  };
}

export function getAssignmentStatusColor(status: AssignmentStatus): string {
  const colors: Record<AssignmentStatus, string> = {
    pending: 'yellow',
    assigned: 'blue',
    running: 'cyan',
    completed: 'green',
    failed: 'red',
    timed_out: 'orange',
    cancelled: 'gray',
    reassigned: 'purple',
  };
  return colors[status];
}

export function filterAssignments(
  assignments: AssignmentEnvelope[],
  filter: AssignmentFilter
): AssignmentEnvelope[] {
  return assignments.filter(assignment => {
    if (filter.taskId && assignment.taskId !== filter.taskId) return false;
    if (filter.nodeId && assignment.assignedNodeId !== filter.nodeId) return false;
    if (filter.workerId && assignment.assignedWorkerId !== filter.workerId) return false;
    if (filter.status && assignment.status !== filter.status) return false;
    if (filter.capability && assignment.capability !== filter.capability) return false;
    if (filter.taskType && assignment.taskType !== filter.taskType) return false;
    if (filter.since && assignment.assignedAt < filter.since) return false;
    if (filter.until && assignment.assignedAt > filter.until) return false;
    return true;
  });
}

export function calculateAssignmentStats(assignments: AssignmentEnvelope[]): AssignmentStats {
  const stats: AssignmentStats = {
    total: assignments.length,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    timed_out: 0,
    cancelled: 0,
    reassigned: 0,
    averageDurationMs: 0,
    successRate: 0,
  };

  let totalCompletedTime = 0;
  let completedCount = 0;

  for (const assignment of assignments) {
    stats[assignment.status]++;

    if (assignment.status === 'completed' || assignment.status === 'failed') {
      const duration = assignment.assignedAt - assignment.assignedAt;
      totalCompletedTime += duration;
      completedCount++;
    }
  }

  stats.averageDurationMs = completedCount > 0 ? Math.round(totalCompletedTime / completedCount) : 0;
  stats.successRate = assignments.length > 0 
    ? Math.round((stats.completed / assignments.length) * 100) 
    : 0;

  return stats;
}

export function isAssignmentExpired(assignment: AssignmentEnvelope, now: number = Date.now()): boolean {
  return assignment.expiresAt < now && 
    (assignment.status === 'pending' || assignment.status === 'assigned');
}

export function isAssignmentStale(assignment: AssignmentEnvelope, now: number = Date.now(), staleThresholdMs: number = 300000): boolean {
  return (now - assignment.assignedAt) > staleThresholdMs;
}
