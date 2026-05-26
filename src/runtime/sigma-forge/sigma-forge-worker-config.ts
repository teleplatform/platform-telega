import type { WorkerRuntime } from '../workers/worker-runtime.js';

export type WorkerExecutionMode = 'direct' | 'worker-backed';

export interface WorkerBackedConfig {
  mode: WorkerExecutionMode;
  workerRuntime: WorkerRuntime | null;
  autoBindContracts: boolean;
  emitDashboardEvents: boolean;
  healthMonitoring: boolean;
}

export function createDefaultWorkerConfig(): WorkerBackedConfig {
  return {
    mode: 'direct',
    workerRuntime: null,
    autoBindContracts: false,
    emitDashboardEvents: false,
    healthMonitoring: false
  };
}

export function createWorkerBackedConfig(workerRuntime: WorkerRuntime): WorkerBackedConfig {
  return {
    mode: 'worker-backed',
    workerRuntime,
    autoBindContracts: true,
    emitDashboardEvents: true,
    healthMonitoring: true
  };
}
