import type { TaskType, RuntimeCapability } from '../sigma-forge/sigma-forge-types.js';

export type WorkerKind = 'local' | 'remote' | 'specialized';
export type WorkerStatus = 'online' | 'busy' | 'offline' | 'degraded' | 'dead';
export type AssignmentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'reassigned';

export interface WorkerCapability {
  taskTypes: TaskType[];
  runtimeCapability: RuntimeCapability;
  maxConcurrency: number;
  features: string[];
}

export interface WorkerHeartbeat {
  workerId: string;
  status: WorkerStatus;
  timestamp: number;
  load: number;
  activeTasks: number;
  maxTasks: number;
  errorsSinceLast: number;
  memoryUsage?: number;
}

export interface RuntimeWorker {
  id: string;
  name: string;
  kind: WorkerKind;
  status: WorkerStatus;
  capabilities: WorkerCapability[];
  heartbeat: WorkerHeartbeat | null;
  assignedTaskIds: string[];
  lastSeen: number;
  registeredAt: number;
  metadata: Record<string, unknown>;
}

export interface WorkerAssignment {
  id: string;
  workerId: string;
  graphId: string;
  nodeId: string;
  taskType: TaskType;
  status: AssignmentStatus;
  assignedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  evidenceRefs: string[];
  contractId: string | null;
  error: string | null;
  durationMs: number | null;
}

export interface WorkerResult {
  ok: boolean;
  output: unknown;
  evidence: string | null;
  durationMs: number;
  error: string | null;
}

export interface WorkerAssignmentRequest {
  graphId: string;
  nodeId: string;
  taskType: TaskType;
  capability: RuntimeCapability;
}
