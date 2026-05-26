import type { TaskType, RuntimeCapability, CapabilityHandler, CapabilityHandlerMap } from '../sigma-forge/sigma-forge-types.js';
import type { RuntimeWorker, WorkerCapability, WorkerResult } from './worker-types.js';
import type { WorkerExecutionOptions } from './worker-execution.js';
import { registerWorker, getAllWorkers, unregisterWorker, workerRegistrySummary } from './worker-registry.js';
import { findBestWorker, assignNodeToWorker, getPendingAssignments, assignmentSummary } from './worker-assignment.js';
import { startHeartbeatMonitor, stopHeartbeatMonitor, sweepDeadWorkers, getHeartbeatStats, recordHeartbeat } from './worker-heartbeat.js';
import { executeNodeThroughWorker, executeNodeDirect } from './worker-execution.js';
import { recoverAllDeadWorkers, recoverTasksFromDeadWorker } from './worker-failure-recovery.js';
import { bindWorkerToContract, getWorkerEvidenceBundle, evidenceLinkageSummary } from './worker-contract-binding.js';
import { emitWorkerEvidence, formatWorkerEvidenceSummary } from './worker-evidence-linkage.js';
import { appendEvidenceRecord } from '../evidence/execution-evidence-store.js';
import { hashTraceId } from '../evidence/execution-hash.js';
import type { GraphNode } from '../sigma-forge/sigma-forge-types.js';

export class WorkerRuntime {
  private handlers: CapabilityHandlerMap = {};
  private initialized = false;

  init(handlers: CapabilityHandlerMap): void {
    this.handlers = handlers;
    this.registerDefaultWorkers();
    this.initialized = true;
  }

  private registerDefaultWorkers(): void {
    const browserCap: WorkerCapability = {
      taskTypes: ['browser.navigate', 'browser.click', 'browser.type', 'browser.extract', 'browser.screenshot', 'browser.wait', 'browser.search', 'browser.verify_condition'],
      runtimeCapability: 'browser',
      maxConcurrency: 3,
      features: ['navigation', 'click', 'type', 'extract', 'screenshot']
    };

    const memoryCap: WorkerCapability = {
      taskTypes: ['memory.store', 'memory.retrieve', 'memory.search'],
      runtimeCapability: 'memory',
      maxConcurrency: 5,
      features: ['store', 'retrieve', 'search']
    };

    const executionCap: WorkerCapability = {
      taskTypes: ['execution.shell', 'execution.http', 'execution.file_read', 'execution.file_write', 'execution.verify'],
      runtimeCapability: 'execution',
      maxConcurrency: 2,
      features: ['shell', 'http', 'file_io']
    };

    const evidenceCap: WorkerCapability = {
      taskTypes: ['evidence.record', 'evidence.verify', 'evidence.export', 'artifact.register', 'mission.summary'],
      runtimeCapability: 'evidence',
      maxConcurrency: 5,
      features: ['record', 'verify', 'export', 'artifact', 'summary']
    };

    const governanceCap: WorkerCapability = {
      taskTypes: ['governance.check'],
      runtimeCapability: 'governance',
      maxConcurrency: 10,
      features: ['policy_check']
    };

    const goalsCap: WorkerCapability = {
      taskTypes: ['goals.create', 'goals.update', 'goals.complete'],
      runtimeCapability: 'goals',
      maxConcurrency: 3,
      features: ['goal_lifecycle']
    };

    registerWorker('browser-worker', 'local', [browserCap], { type: 'playwright-chromium' });
    registerWorker('memory-worker', 'local', [memoryCap], { type: 'file-json-store' });
    registerWorker('execution-worker', 'local', [executionCap], { type: 'subprocess' });
    registerWorker('evidence-worker', 'local', [evidenceCap], { type: 'jsonl-store' });
    registerWorker('governance-worker', 'local', [governanceCap], { type: 'policy-engine' });
    registerWorker('goals-worker', 'local', [goalsCap], { type: 'goal-engine' });
  }

  async executeNode(node: GraphNode, graphId: string): Promise<WorkerResult> {
    const options: WorkerExecutionOptions = {
      handlers: this.handlers,
      emitEvidence: true,
      graphId
    };
    const { result, assignment } = await executeNodeThroughWorker(node, options);
    if (assignment) {
      await emitWorkerEvidence(assignment, result);
    }
    return result;
  }

  findWorker(taskType: TaskType): RuntimeWorker | undefined {
    return findBestWorker(taskType);
  }

  getWorkers(): RuntimeWorker[] {
    return getAllWorkers();
  }

  startHealthMonitoring(): void {
    startHeartbeatMonitor();
  }

  stopHealthMonitoring(): void {
    stopHeartbeatMonitor();
  }

  runRecovery(): { reassigned: number; failed: number } {
    sweepDeadWorkers();
    return recoverAllDeadWorkers();
  }

  bindContract(contractId: string, workerId: string): boolean {
    return bindWorkerToContract(contractId, workerId);
  }

  getSummary(): string {
    return [
      workerRegistrySummary(),
      assignmentSummary(),
      evidenceLinkageSummary(),
      `Heartbeat: ${JSON.stringify(getHeartbeatStats())}`
    ].join('\n');
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
