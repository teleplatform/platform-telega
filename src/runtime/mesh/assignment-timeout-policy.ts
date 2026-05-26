import type { AssignmentEnvelope, AssignmentStatus } from './remote-assignment-envelope.js';

export interface TimeoutPolicy {
  defaultTimeoutMs: number;
  taskTypeTimeouts: Record<string, number>;
  capabilityTimeouts: Record<string, number>;
  retryPolicy: {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    exponentialBackoff: boolean;
    jitter: boolean;
  };
  cleanupPolicy: {
    staleAssignmentThresholdMs: number;
    expiredAssignmentCleanupIntervalMs: number;
    failedAssignmentRetentionDays: number;
  };
}

export interface TimeoutAction {
  type: 'retry' | 'timeout' | 'escalate' | 'cancel' | 'reassign';
  assignmentId: string;
  reason: string;
  timestamp: number;
  nextActionAt?: number;
  metadata: Record<string, unknown>;
}

export interface TimeoutEvent {
  assignmentId: string;
  taskId: string;
  taskType: string;
  assignedNodeId: string;
  assignedWorkerId: string;
  originalTimeoutMs: number;
  elapsedMs: number;
  remainingMs: number;
  status: AssignmentStatus;
  retryCount: number;
  action: TimeoutAction;
}

export interface TimeoutMetrics {
  totalAssignments: number;
  timedOut: number;
  retries: number;
  reassignments: number;
  cancellations: number;
  averageTimeoutDuration: number;
  retrySuccessRate: number;
  taskTypeTimeoutRates: Record<string, number>;
}

export const DEFAULT_TIMEOUT_POLICY: TimeoutPolicy = {
  defaultTimeoutMs: 300000, // 5 minutes
  taskTypeTimeouts: {
    'browser.execute': 120000,
    'browser.navigate': 45000,
    'storage.read': 30000,
    'storage.write': 60000,
    'compute.heavy': 600000,
    'compute.light': 30000,
    'network.request': 45000,
  },
  capabilityTimeouts: {
    browser: 45000,
    storage: 60000,
    compute: 300000,
    network: 45000,
  },
  retryPolicy: {
    maxRetries: 3,
    baseDelayMs: 5000,
    maxDelayMs: 30000,
    exponentialBackoff: true,
    jitter: true,
  },
  cleanupPolicy: {
    staleAssignmentThresholdMs: 900000, // 15 minutes
    expiredAssignmentCleanupIntervalMs: 3600000, // 1 hour
    failedAssignmentRetentionDays: 7,
  },
};

export function getAssignmentTimeout(
  assignment: AssignmentEnvelope,
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): number {
  // Check task-specific timeout first
  if (policy.taskTypeTimeouts[assignment.taskType]) {
    return policy.taskTypeTimeouts[assignment.taskType];
  }

  // Check capability-specific timeout
  if (policy.capabilityTimeouts[assignment.capability]) {
    return policy.capabilityTimeouts[assignment.capability];
  }

  // Use default timeout
  return policy.defaultTimeoutMs;
}

export function calculateTimeoutAction(
  assignment: AssignmentEnvelope,
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): TimeoutAction {
  const now = Date.now();
  const elapsed = now - assignment.assignedAt;
  const timeout = getAssignmentTimeout(assignment, policy);
  
  if (elapsed < timeout) {
    return null; // No timeout action needed
  }

  const actionType: TimeoutAction['type'] = 
    assignment.retryCount < policy.retryPolicy.maxRetries ? 'retry' : 'timeout';

  return {
    type: actionType,
    assignmentId: assignment.id,
    reason: `Assignment timeout after ${elapsed}ms (limit: ${timeout}ms)`,
    timestamp: now,
    nextActionAt: actionType === 'retry' ? now + getRetryDelay(assignment.retryCount, policy) : undefined,
    metadata: {
      elapsedMs: elapsed,
      timeoutMs: timeout,
      retryCount: assignment.retryCount,
      maxRetries: policy.retryPolicy.maxRetries,
    },
  };
}

export function getRetryDelay(
  retryCount: number,
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): number {
  const { baseDelayMs, maxDelayMs, exponentialBackoff, jitter } = policy.retryPolicy;
  
  let delay = baseDelayMs;
  
  if (exponentialBackoff) {
    delay = Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs);
  }
  
  if (jitter) {
    delay = delay * (0.5 + Math.random() * 0.5);
  }
  
  return Math.round(delay);
}

export function isAssignmentStale(
  assignment: AssignmentEnvelope,
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): boolean {
  const now = Date.now();
  const staleThreshold = policy.cleanupPolicy.staleAssignmentThresholdMs;
  return (now - assignment.assignedAt) > staleThreshold;
}

export function getExpiredAssignments(
  assignments: AssignmentEnvelope[],
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): AssignmentEnvelope[] {
  const now = Date.now();
  
  return assignments.filter(assignment => {
    const timeout = getAssignmentTimeout(assignment, policy);
    return (now - assignment.assignedAt) > timeout;
  });
}

export function getStaleAssignments(
  assignments: AssignmentEnvelope[],
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): AssignmentEnvelope[] {
  return assignments.filter(assignment => isAssignmentStale(assignment, policy));
}

export function shouldRetryAssignment(
  assignment: AssignmentEnvelope,
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): boolean {
  return assignment.retryCount < policy.retryPolicy.maxRetries &&
         (assignment.status === 'failed' || assignment.status === 'timed_out');
}

export function getTimeoutMetrics(
  assignments: AssignmentEnvelope[],
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): TimeoutMetrics {
  const now = Date.now();
  
  const timedOut = assignments.filter(a => a.status === 'timed_out').length;
  const retries = assignments.reduce((sum, a) => sum + a.retryCount, 0);
  const reassignments = assignments.filter(a => a.status === 'reassigned').length;
  const cancellations = assignments.filter(a => a.status === 'cancelled').length;
  
  const completedAssignments = assignments.filter(a => 
    a.status === 'completed' || a.status === 'failed'
  );
  
  const totalDuration = completedAssignments.reduce((sum, a) => {
    return sum + (a.assignedAt - a.assignedAt);
  }, 0);
  
  const averageTimeoutDuration = completedAssignments.length > 0 
    ? Math.round(totalDuration / completedAssignments.length) 
    : 0;

  // Calculate task type timeout rates
  const taskTypeTimeoutRates: Record<string, number> = {};
  const taskTypeCounts: Record<string, number> = {};
  
  for (const assignment of assignments) {
    taskTypeCounts[assignment.taskType] = (taskTypeCounts[assignment.taskType] || 0) + 1;
    
    if (assignment.status === 'timed_out') {
      taskTypeTimeoutRates[assignment.taskType] = 
        ((taskTypeTimeoutRates[assignment.taskType] || 0) + 1);
    }
  }
  
  for (const taskType in taskTypeCounts) {
    if (taskTypeTimeoutRates[taskType]) {
      taskTypeTimeoutRates[taskType] = Math.round(
        (taskTypeTimeoutRates[taskType] / taskTypeCounts[taskType]) * 100
      );
    }
  }

  return {
    totalAssignments: assignments.length,
    timedOut,
    retries,
    reassignments,
    cancellations,
    averageTimeoutDuration,
    retrySuccessRate: completedAssignments.length > 0 
      ? Math.round(((completedAssignments.filter(a => a.status === 'completed').length) / completedAssignments.length) * 100)
      : 0,
    taskTypeTimeoutRates,
  };
}

export function generateTimeoutActionForAssignment(
  assignment: AssignmentEnvelope,
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): TimeoutAction {
  const action = calculateTimeoutAction(assignment, policy);
  
  if (!action) {
    return null;
  }

  // Update assignment retry count if retrying
  if (action.type === 'retry') {
    assignment.retryCount++;
    assignment.status = 'pending';
    assignment.metadata = {
      ...assignment.metadata,
      retryCount: assignment.retryCount,
      lastRetryAt: Date.now(),
    };
  }

  return action;
}

export function scheduleTimeoutCheck(
  assignments: AssignmentEnvelope[],
  policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY
): TimeoutAction[] {
  const actions: TimeoutAction[] = [];
  
  for (const assignment of assignments) {
    const action = generateTimeoutActionForAssignment(assignment, policy);
    if (action) {
      actions.push(action);
    }
  }
  
  return actions;
}
