import type { MeshNodeInfo } from './mesh-node-types.js';
import type { 
  AssignmentEnvelope, 
  AssignmentStatus, 
  RemoteAssignmentRequest,
  RemoteAssignmentResponse,
  AssignmentFilter,
  AssignmentStats 
} from './remote-assignment-envelope.js';
import type { WorkerBinding, WorkerBindingRequest, WorkerBindingResponse } from './remote-worker-binding.js';

export interface AssignmentSyncRequest {
  nodeId: string;
  assignments: AssignmentEnvelope[];
  workerBindings: WorkerBinding[];
  timestamp: number;
  syncToken: string;
}

export interface AssignmentSyncResponse {
  ok: boolean;
  nodeId: string;
  timestamp: number;
  assignmentsUpdated: number;
  assignmentsRemoved: number;
  bindingsUpdated: number;
  bindingsRemoved: number;
  conflicts: AssignmentConflict[];
  error?: string;
}

export interface AssignmentConflict {
  type: 'assignment' | 'binding' | 'status' | 'timestamp';
  localValue: any;
  remoteValue: any;
  resolution: 'local-wins' | 'remote-wins' | 'merge' | 'conflict';
  assignmentId?: string;
  bindingId?: string;
}

export interface AssignmentSyncStatus {
  nodeId: string;
  lastSyncAt: number;
  lastSuccessfulSyncAt: number;
  syncIntervalMs: number;
  isHealthy: boolean;
  latencyMs: number;
  lastSyncResult: AssignmentSyncResponse | null;
  retryCount: number;
  errorCount: number;
}

export interface AssignmentSyncConfig {
  syncIntervalMs: number;
  retryDelayMs: number;
  maxRetries: number;
  enableConflictResolution: boolean;
  conflictResolutionStrategy: 'local-wins' | 'remote-wins' | 'merge';
  syncAssignmentStatus: boolean;
  syncWorkerBindings: boolean;
  syncNodeHealth: boolean;
}

export const DEFAULT_SYNC_CONFIG: AssignmentSyncConfig = {
  syncIntervalMs: 30000, // 30 seconds
  retryDelayMs: 5000,
  maxRetries: 3,
  enableConflictResolution: true,
  conflictResolutionStrategy: 'merge',
  syncAssignmentStatus: true,
  syncWorkerBindings: true,
  syncNodeHealth: true,
};

export class AssignmentSyncManager {
  private assignments: Map<string, AssignmentEnvelope> = new Map();
  private workerBindings: Map<string, WorkerBinding> = new Map();
  private syncStatus: Map<string, AssignmentSyncStatus> = new Map();
  private config: AssignmentSyncConfig;
  private syncIntervalId: NodeJS.Timeout | null = null;
  private lastSyncToken = Date.now().toString();

  constructor(config: AssignmentSyncConfig = DEFAULT_SYNC_CONFIG) {
    this.config = config;
  }

  public startSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
    }

    this.syncIntervalId = setInterval(() => {
      this.performPeriodicSync();
    }, this.config.syncIntervalMs);
  }

  public stopSync(): void {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }

  public async syncWithNode(
    nodeId: string,
    remoteAssignments: AssignmentEnvelope[],
    remoteBindings: WorkerBinding[]
  ): Promise<AssignmentSyncResponse> {
    const now = Date.now();
    const localStatus = this.syncStatus.get(nodeId) || {
      nodeId,
      lastSyncAt: 0,
      lastSuccessfulSyncAt: 0,
      syncIntervalMs: this.config.syncIntervalMs,
      isHealthy: true,
      latencyMs: 0,
      lastSyncResult: null,
      retryCount: 0,
      errorCount: 0,
    };

    const startTime = Date.now();
    let conflicts: AssignmentConflict[] = [];

    // Sync assignments
    let assignmentsUpdated = 0;
    let assignmentsRemoved = 0;

    if (this.config.syncAssignmentStatus) {
      const assignmentSyncResult = this.syncAssignments(nodeId, remoteAssignments);
      assignmentsUpdated = assignmentSyncResult.updated;
      assignmentsRemoved = assignmentSyncResult.removed;
      conflicts.push(...assignmentSyncResult.conflicts);
    }

    // Sync worker bindings
    let bindingsUpdated = 0;
    let bindingsRemoved = 0;

    if (this.config.syncWorkerBindings) {
      const bindingSyncResult = this.syncWorkerBindings(nodeId, remoteBindings);
      bindingsUpdated = bindingSyncResult.updated;
      bindingsRemoved = bindingSyncResult.removed;
      conflicts.push(...bindingSyncResult.conflicts);
    }

    const latencyMs = Date.now() - startTime;
    const isHealthy = conflicts.length === 0 || this.resolveConflicts(conflicts).every(c => c.resolution !== 'conflict');

    // Update sync status
    localStatus.lastSyncAt = now;
    localStatus.latencyMs = latencyMs;
    localStatus.isHealthy = isHealthy;
    localStatus.retryCount = 0;
    localStatus.errorCount = 0;
    localStatus.lastSyncResult = {
      ok: isHealthy,
      nodeId,
      timestamp: now,
      assignmentsUpdated,
      assignmentsRemoved,
      bindingsUpdated,
      bindingsRemoved,
      conflicts,
    };

    if (isHealthy) {
      localStatus.lastSuccessfulSyncAt = now;
    }

    this.syncStatus.set(nodeId, localStatus);

    return localStatus.lastSyncResult;
  }

  private syncAssignments(nodeId: string, remoteAssignments: AssignmentEnvelope[]): {
    updated: number;
    removed: number;
    conflicts: AssignmentConflict[];
  } {
    let updated = 0;
    let removed = 0;
    const conflicts: AssignmentConflict[] = [];

    // Process remote assignments
    for (const remoteAssignment of remoteAssignments) {
      const localAssignment = this.assignments.get(remoteAssignment.id);

      if (!localAssignment) {
        // New assignment, add it
        this.assignments.set(remoteAssignment.id, remoteAssignment);
        updated++;
      } else {
        // Existing assignment, check for conflicts
        const conflict = this.checkAssignmentConflict(localAssignment, remoteAssignment);
        if (conflict) {
          conflicts.push(conflict);
          
          // Resolve conflict based on strategy
          const resolution = this.resolveAssignmentConflict(localAssignment, remoteAssignment, conflict);
          if (resolution === 'local-wins') {
            // Keep local, no update
          } else if (resolution === 'remote-wins') {
            this.assignments.set(remoteAssignment.id, remoteAssignment);
            updated++;
          } else if (resolution === 'merge') {
            // Merge the assignments
            const merged = this.mergeAssignments(localAssignment, remoteAssignment);
            this.assignments.set(merged.id, merged);
            updated++;
          }
        } else {
          // No conflict, update with remote
          this.assignments.set(remoteAssignment.id, remoteAssignment);
          updated++;
        }
      }
    }

    // Remove assignments that no longer exist on remote
    const existingAssignmentIds = new Set(remoteAssignments.map(a => a.id));
    for (const [assignmentId, localAssignment] of this.assignments) {
      if (!existingAssignmentIds.has(assignmentId) && localAssignment.assignedNodeId === nodeId) {
        this.assignments.delete(assignmentId);
        removed++;
      }
    }

    return { updated, removed, conflicts };
  }

  private syncWorkerBindings(nodeId: string, remoteBindings: WorkerBinding[]): {
    updated: number;
    removed: number;
    conflicts: AssignmentConflict[];
  } {
    let updated = 0;
    let removed = 0;
    const conflicts: AssignmentConflict[] = [];

    // Process remote bindings
    for (const remoteBinding of remoteBindings) {
      const localBinding = this.workerBindings.get(remoteBinding.id);

      if (!localBinding) {
        // New binding, add it
        this.workerBindings.set(remoteBinding.id, remoteBinding);
        updated++;
      } else {
        // Existing binding, check for conflicts
        const conflict = this.checkBindingConflict(localBinding, remoteBinding);
        if (conflict) {
          conflicts.push(conflict);
          
          // Simple resolution: remote wins for bindings
          this.workerBindings.set(remoteBinding.id, remoteBinding);
          updated++;
        } else {
          // No conflict, update with remote
          this.workerBindings.set(remoteBinding.id, remoteBinding);
          updated++;
        }
      }
    }

    // Remove bindings that no longer exist on remote
    const existingBindingIds = new Set(remoteBindings.map(b => b.id));
    for (const [bindingId, localBinding] of this.workerBindings) {
      if (!existingBindingIds.has(bindingId) && localBinding.nodeId === nodeId) {
        this.workerBindings.delete(bindingId);
        removed++;
      }
    }

    return { updated, removed, conflicts };
  }

  private checkAssignmentConflict(local: AssignmentEnvelope, remote: AssignmentEnvelope): AssignmentConflict | null {
    // Check for status conflicts
    if (local.status !== remote.status && 
        Math.abs(local.assignedAt - remote.assignedAt) > 5000) {
      return {
        type: 'status',
        localValue: local.status,
        remoteValue: remote.status,
        resolution: 'merge',
        assignmentId: local.id,
      };
    }

    // Check for timestamp conflicts
    if (Math.abs(local.assignedAt - remote.assignedAt) > 10000) {
      return {
        type: 'timestamp',
        localValue: local.assignedAt,
        remoteValue: remote.assignedAt,
        resolution: 'merge',
        assignmentId: local.id,
      };
    }

    return null;
  }

  private checkBindingConflict(local: WorkerBinding, remote: WorkerBinding): AssignmentConflict | null {
    // Check for status conflicts
    if (local.bindingStatus !== remote.bindingStatus) {
      return {
        type: 'status',
        localValue: local.bindingStatus,
        remoteValue: remote.bindingStatus,
        resolution: 'remote-wins',
        bindingId: local.id,
      };
    }

    return null;
  }

  private resolveAssignmentConflict(
    local: AssignmentEnvelope,
    remote: AssignmentEnvelope,
    conflict: AssignmentConflict
  ): 'local-wins' | 'remote-wins' | 'merge' {
    if (!this.config.enableConflictResolution) {
      return 'conflict';
    }

    switch (this.config.conflictResolutionStrategy) {
      case 'local-wins':
        return 'local-wins';
      case 'remote-wins':
        return 'remote-wins';
      case 'merge':
        return 'merge';
      default:
        return 'conflict';
    }
  }

  private resolveConflicts(conflicts: AssignmentConflict[]): AssignmentConflict[] {
    if (!this.config.enableConflictResolution) {
      return conflicts;
    }

    return conflicts.map(conflict => {
      if (conflict.type === 'status') {
        return {
          ...conflict,
          resolution: this.config.conflictResolutionStrategy,
        };
      }
      return conflict;
    });
  }

  private mergeAssignments(local: AssignmentEnvelope, remote: AssignmentEnvelope): AssignmentEnvelope {
    return {
      ...local,
      status: remote.status, // Use the latest status
      assignedAt: Math.max(local.assignedAt, remote.assignedAt),
      expiresAt: Math.max(local.expiresAt, remote.expiresAt),
      retryCount: Math.max(local.retryCount, remote.retryCount),
      metadata: {
        ...local.metadata,
        ...remote.metadata,
        mergedAt: Date.now(),
        mergedFrom: [local.id, remote.id],
      },
    };
  }

  private performPeriodicSync(): void {
    // This would be implemented to sync with all known nodes
    // For now, it's a placeholder
  }

  public getAssignments(filter?: AssignmentFilter): AssignmentEnvelope[] {
    let assignments = Array.from(this.assignments.values());

    if (filter) {
      if (filter.taskId) {
        assignments = assignments.filter(a => a.taskId === filter.taskId);
      }
      if (filter.nodeId) {
        assignments = assignments.filter(a => a.assignedNodeId === filter.nodeId);
      }
      if (filter.status) {
        assignments = assignments.filter(a => a.status === filter.status);
      }
      if (filter.capability) {
        assignments = assignments.filter(a => a.capability === filter.capability);
      }
      if (filter.taskType) {
        assignments = assignments.filter(a => a.taskType === filter.taskType);
      }
      if (filter.since) {
        assignments = assignments.filter(a => a.assignedAt >= filter.since);
      }
      if (filter.until) {
        assignments = assignments.filter(a => a.assignedAt <= filter.until);
      }
    }

    return assignments;
  }

  public getWorkerBindings(nodeId?: string, assignmentId?: string): WorkerBinding[] {
    let bindings = Array.from(this.workerBindings.values());

    if (nodeId) {
      bindings = bindings.filter(b => b.nodeId === nodeId);
    }

    if (assignmentId) {
      bindings = bindings.filter(b => b.assignmentId === assignmentId);
    }

    return bindings;
  }

  public getSyncStatus(nodeId?: string): AssignmentSyncStatus[] {
    const statuses = Array.from(this.syncStatus.values());
    
    if (nodeId) {
      const status = statuses.find(s => s.nodeId === nodeId);
      return status ? [status] : [];
    }
    
    return statuses;
  }

  public getStats(): {
    assignments: AssignmentStats;
    bindings: number;
    syncStatus: number;
    healthyNodes: number;
  } {
    const assignments = this.getAssignments();
    const stats = this.calculateAssignmentStats(assignments);

    const syncStatus = Array.from(this.syncStatus.values());
    const healthyNodes = syncStatus.filter(s => s.isHealthy).length;

    return {
      assignments: stats,
      bindings: this.workerBindings.size,
      syncStatus: syncStatus.length,
      healthyNodes,
    };
  }

  private calculateAssignmentStats(assignments: AssignmentEnvelope[]): AssignmentStats {
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

    for (const assignment of assignments) {
      stats[assignment.status]++;
    }

    const completed = assignments.filter(a => a.status === 'completed').length;
    stats.successRate = assignments.length > 0 ? Math.round((completed / assignments.length) * 100) : 0;

    return stats;
  }
}
