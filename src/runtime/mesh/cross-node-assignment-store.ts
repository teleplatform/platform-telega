import type { MeshNodeInfo } from './mesh-node-types.js';
import type { AssignmentEnvelope, RemoteAssignmentRequest, RemoteAssignmentResponse } from './remote-assignment-envelope.js';
import type { WorkerBinding, WorkerBindingRequest } from './remote-worker-binding.js';
import { AssignmentSyncManager } from './assignment-status-sync.js';
import type { TimeoutPolicy, TimeoutAction } from './assignment-timeout-policy.js';

export interface AssignmentStoreConfig {
  storageType: 'memory' | 'persistent';
  retentionDays: number;
  cleanupIntervalMs: number;
  enableBackup: boolean;
  backupIntervalMs: number;
}

export interface CrossNodeAssignmentStore {
  assignments: Map<string, AssignmentEnvelope>;
  workerBindings: Map<string, WorkerBinding>;
  syncManager: AssignmentSyncManager;
  config: AssignmentStoreConfig;
}

export interface AssignmentCreationResult {
  assignmentId: string;
  nodeId: string;
  workerId: string;
  success: boolean;
  error?: string;
  estimatedDuration: number;
}

export interface AssignmentUpdateResult {
  success: boolean;
  error?: string;
  oldStatus: AssignmentStatus;
  newStatus: AssignmentStatus;
}

export interface AssignmentQueryResult {
  assignments: AssignmentEnvelope[];
  total: number;
  hasMore: boolean;
  cursor?: string;
}

export type AssignmentStatus = 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'timed_out' | 'cancelled' | 'reassigned';

export class CrossNodeAssignmentStore {
  private assignments: Map<string, AssignmentEnvelope> = new Map();
  private workerBindings: Map<string, WorkerBinding> = new Map();
  private syncManager: AssignmentSyncManager;
  private config: AssignmentStoreConfig;
  private cleanupIntervalId: NodeJS.Timeout | null = null;
  private backupIntervalId: NodeJS.Timeout | null = null;

  constructor(config: AssignmentStoreConfig = {
    storageType: 'memory',
    retentionDays: 7,
    cleanupIntervalMs: 3600000, // 1 hour
    enableBackup: true,
    backupIntervalMs: 86400000, // 24 hours
  }) {
    this.config = config;
    this.syncManager = new AssignmentSyncManager();
    
    this.startCleanup();
    if (this.config.enableBackup) {
      this.startBackup();
    }
  }

  public async createAssignment(
    request: RemoteAssignmentRequest,
    nodes: MeshNodeInfo[],
    timeoutPolicy?: TimeoutPolicy
  ): Promise<AssignmentCreationResult> {
    try {
      // Select best node for the assignment
      const bestNode = this.selectBestNodeForAssignment(request, nodes);
      if (!bestNode) {
        return {
          assignmentId: '',
          nodeId: '',
          workerId: '',
          success: false,
          error: 'No suitable node available for assignment',
          estimatedDuration: 0,
        };
      }

      // Create assignment envelope
      const assignmentEnvelope = this.createAssignmentEnvelope(request, bestNode.node.id);
      
      // Create worker binding
      const workerBinding = this.createWorkerBinding(
        assignmentEnvelope,
        bestNode.node.id,
        bestNode.workerId
      );

      // Store the assignment
      this.assignments.set(assignmentEnvelope.id, assignmentEnvelope);
      this.workerBindings.set(workerBinding.id, workerBinding);

      // Sync with the target node
      await this.syncWithNode(bestNode.node.id, [assignmentEnvelope], [workerBinding]);

      return {
        assignmentId: assignmentEnvelope.id,
        nodeId: bestNode.node.id,
        workerId: bestNode.workerId,
        success: true,
        estimatedDuration: request.timeoutMs,
      };
    } catch (error) {
      return {
        assignmentId: '',
        nodeId: '',
        workerId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        estimatedDuration: 0,
      };
    }
  }

  public async updateAssignmentStatus(
    assignmentId: string,
    newStatus: AssignmentStatus,
    reason: string = '',
    metadata?: Record<string, unknown>
  ): Promise<AssignmentUpdateResult> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      return {
        success: false,
        error: 'Assignment not found',
        oldStatus: 'pending',
        newStatus: 'pending',
      };
    }

    const oldStatus = assignment.status;
    assignment.status = newStatus;
    assignment.metadata = {
      ...assignment.metadata,
      statusUpdatedAt: Date.now(),
      statusUpdateReason: reason,
      ...metadata,
    };

    // Update associated worker binding
    const binding = Array.from(this.workerBindings.values())
      .find(b => b.assignmentId === assignmentId);
    
    if (binding) {
      binding.bindingStatus = newStatus === 'running' ? 'active' : 
                               newStatus === 'completed' ? 'inactive' : 
                               'broken';
    }

    // Sync the status update
    await this.syncStatusUpdate(assignment, binding);

    return {
      success: true,
      oldStatus,
      newStatus,
    };
  }

  public getAssignments(filter?: {
    nodeId?: string;
    taskType?: string;
    capability?: string;
    status?: AssignmentStatus;
    since?: number;
    until?: number;
  }): AssignmentQueryResult {
    let assignments = Array.from(this.assignments.values());

    if (filter) {
      if (filter.nodeId) {
        assignments = assignments.filter(a => a.assignedNodeId === filter.nodeId);
      }
      if (filter.taskType) {
        assignments = assignments.filter(a => a.taskType === filter.taskType);
      }
      if (filter.capability) {
        assignments = assignments.filter(a => a.capability === filter.capability);
      }
      if (filter.status) {
        assignments = assignments.filter(a => a.status === filter.status);
      }
      if (filter.since) {
        assignments = assignments.filter(a => a.assignedAt >= filter.since);
      }
      if (filter.until) {
        assignments = assignments.filter(a => a.assignedAt <= filter.until);
      }
    }

    // Sort by assignedAt (newest first)
    assignments.sort((a, b) => b.assignedAt - a.assignedAt);

    return {
      assignments,
      total: assignments.length,
      hasMore: false,
    };
  }

  public getWorkerBindings(assignmentId?: string, nodeId?: string): WorkerBinding[] {
    let bindings = Array.from(this.workerBindings.values());

    if (assignmentId) {
      bindings = bindings.filter(b => b.assignmentId === assignmentId);
    }

    if (nodeId) {
      bindings = bindings.filter(b => b.nodeId === nodeId);
    }

    return bindings;
  }

  public async cancelAssignment(assignmentId: string, reason: string = 'Cancelled by user'): Promise<boolean> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      return false;
    }

    await this.updateAssignmentStatus(assignmentId, 'cancelled', reason);

    // Cancel associated worker binding
    const binding = Array.from(this.workerBindings.values())
      .find(b => b.assignmentId === assignmentId);
    
    if (binding) {
      binding.bindingStatus = 'inactive';
    }

    return true;
  }

  public async reassignAssignment(
    assignmentId: string,
    newNodeId: string,
    newWorkerId?: string,
    reason: string = 'Reassigned due to failure'
  ): Promise<boolean> {
    const assignment = this.assignments.get(assignmentId);
    if (!assignment) {
      return false;
    }

    // Update assignment
    assignment.assignedNodeId = newNodeId;
    assignment.assignedWorkerId = newWorkerId || 'auto-select';
    assignment.status = 'pending';
    assignment.retryCount++;
    assignment.metadata = {
      ...assignment.metadata,
      reassignedAt: Date.now(),
      reassignedFrom: assignment.assignedNodeId,
      reassignedTo: newNodeId,
      reassignedReason: reason,
    };

    // Create new worker binding
    const newBinding = this.createWorkerBinding(
      assignment,
      newNodeId,
      newWorkerId
    );

    this.workerBindings.set(newBinding.id, newBinding);

    // Sync the reassignment
    await this.syncWithNode(newNodeId, [assignment], [newBinding]);

    return true;
  }

  public getAssignmentStats(): {
    total: number;
    byStatus: Record<AssignmentStatus, number>;
    byNode: Record<string, number>;
    byCapability: Record<string, number>;
    averageDuration: number;
    successRate: number;
  } {
    const assignments = Array.from(this.assignments.values());
    
    const byStatus: Record<AssignmentStatus, number> = {
      pending: 0,
      assigned: 0,
      running: 0,
      completed: 0,
      failed: 0,
      timed_out: 0,
      cancelled: 0,
      reassigned: 0,
    };

    const byNode: Record<string, number> = {};
    const byCapability: Record<string, number> = {};

    let totalDuration = 0;
    let completedCount = 0;

    for (const assignment of assignments) {
      byStatus[assignment.status]++;
      byNode[assignment.assignedNodeId] = (byNode[assignment.assignedNodeId] || 0) + 1;
      byCapability[assignment.capability] = (byCapability[assignment.capability] || 0) + 1;

      if (assignment.status === 'completed' || assignment.status === 'failed') {
        const duration = Date.now() - assignment.assignedAt;
        totalDuration += duration;
        completedCount++;
      }
    }

    return {
      total: assignments.length,
      byStatus,
      byNode,
      byCapability,
      averageDuration: completedCount > 0 ? Math.round(totalDuration / completedCount) : 0,
      successRate: assignments.length > 0 
        ? Math.round((byStatus.completed / assignments.length) * 100) 
        : 0,
    };
  }

  private selectBestNodeForAssignment(
    request: RemoteAssignmentRequest,
    nodes: MeshNodeInfo[]
  ): { node: MeshNodeInfo; workerId: string } | null {
    // Filter nodes by capability and availability
    const candidateNodes = nodes.filter(node => 
      node.status === 'online' &&
      node.capabilities.some(c => 
        c.runtimeCapability === request.capability && 
        c.taskTypes.includes(request.taskType as any)
      )
    );

    if (candidateNodes.length === 0) {
      return null;
    }

    // Score nodes based on multiple factors
    const scoredNodes = candidateNodes.map(node => {
      const capacity = node.capabilities.find(c => 
        c.runtimeCapability === request.capability
      )?.capacity || 0;
      
      const load = node.capabilities.find(c => 
        c.runtimeCapability === request.capability
      )?.currentLoad || 0;

      const loadFactor = capacity > 0 ? 1 - (load / capacity) : 0;
      const healthScore = node.status === 'online' ? 1 : 0.5;
      const workerScore = node.workerCount > 0 ? 1 : 0;
      
      const totalScore = loadFactor * 0.4 + healthScore * 0.3 + workerScore * 0.3;

      return {
        node,
        workerId: 'auto-select',
        score: totalScore,
      };
    });

    // Sort by score and return the best
    scoredNodes.sort((a, b) => b.score - a.score);
    return scoredNodes[0];
  }

  private createAssignmentEnvelope(
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

  private createWorkerBinding(
    assignment: AssignmentEnvelope,
    nodeId: string,
    workerId?: string
  ): WorkerBinding {
    const bindingId = `binding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    const expiresAt = assignment.expiresAt;

    return {
      assignmentId: assignment.id,
      nodeId,
      workerId: workerId || 'auto-select',
      taskId: assignment.taskId,
      taskType: assignment.taskType,
      capability: assignment.capability,
      bindingType: nodeId === assignment.assignedNodeId ? 'local' : 'remote',
      bindingStatus: 'active',
      boundAt: now,
      expiresAt,
      metadata: {},
    };
  }

  private async syncWithNode(
    nodeId: string,
    assignments: AssignmentEnvelope[],
    bindings: WorkerBinding[]
  ): Promise<void> {
    try {
      await this.syncManager.syncWithNode(nodeId, assignments, bindings);
    } catch (error) {
      console.error(`Failed to sync with node ${nodeId}:`, error);
    }
  }

  private async syncStatusUpdate(
    assignment: AssignmentEnvelope,
    binding?: WorkerBinding
  ): Promise<void> {
    if (!assignment.assignedNodeId) return;
    
    try {
      await this.syncManager.syncWithNode(
        assignment.assignedNodeId,
        [assignment],
        binding ? [binding] : []
      );
    } catch (error) {
      console.error(`Failed to sync status update for assignment ${assignment.id}:`, error);
    }
  }

  private startCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }

    this.cleanupIntervalId = setInterval(() => {
      this.cleanupExpiredAssignments();
    }, this.config.cleanupIntervalMs);
  }

  private startBackup(): void {
    if (this.backupIntervalId) {
      clearInterval(this.backupIntervalId);
    }

    this.backupIntervalId = setInterval(() => {
      this.createBackup();
    }, this.config.backupIntervalMs);
  }

  private cleanupExpiredAssignments(): void {
    const now = Date.now();
    const expiredAssignments = Array.from(this.assignments.values())
      .filter(a => a.expiresAt < now);

    for (const assignment of expiredAssignments) {
      this.assignments.delete(assignment.id);
      
      // Remove associated bindings
      const bindings = Array.from(this.workerBindings.values())
        .filter(b => b.assignmentId === assignment.id);
      
      for (const binding of bindings) {
        this.workerBindings.delete(binding.id);
      }
    }
  }

  private createBackup(): void {
    // This would implement backup logic for persistent storage
    // For now, it's a placeholder
  }

  public shutdown(): void {
    this.stopCleanup();
    this.stopBackup();
    this.syncManager.stopSync();
  }

  private stopCleanup(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  private stopBackup(): void {
    if (this.backupIntervalId) {
      clearInterval(this.backupIntervalId);
      this.backupIntervalId = null;
    }
  }
}
