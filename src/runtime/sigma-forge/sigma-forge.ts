import { SigmaForgeResult, CapabilityHandlerMap, CapabilityHandler } from './sigma-forge-types.js';
import { analyzeIntent } from './intent-analyzer.js';
import { decomposeTemplate } from './task-decomposer.js';
import { buildGraph } from './execution-graph.js';
import { executeDAG, buildPlanFromGraph, DAGRuntimeOptions } from './dag-runtime.js';
import { createContract, completeContract, failContract } from './runtime-contracts.js';
import { pushResult } from './sigma-forge-store.js';
import { initControlState, checkControl } from './graph-control-store.js';
import { createWorkerBackedHandlers, createWorkerBackedDAGOptions } from './dag-worker-adapter.js';
import type { WorkerBackedConfig } from './sigma-forge-worker-config.js';
import { WorkerRuntime } from '../workers/worker-runtime.js';

export class SigmaForge {
  private handlers: CapabilityHandlerMap = {};
  private results: SigmaForgeResult[] = [];
  private workerConfig: WorkerBackedConfig | null = null;

  registerCapability(capability: string, handler: CapabilityHandler): void {
    this.handlers[capability] = handler;
  }

  getHandlers(): CapabilityHandlerMap {
    return { ...this.handlers };
  }

  getResults(): SigmaForgeResult[] {
    return [...this.results];
  }

  getLastResult(): SigmaForgeResult | null {
    return this.results.length > 0 ? this.results[this.results.length - 1] : null;
  }

  enableWorkerMode(config: WorkerBackedConfig): void {
    this.workerConfig = config;
    if (config.workerRuntime && config.healthMonitoring) {
      config.workerRuntime.startHealthMonitoring();
    }
  }

  disableWorkerMode(): void {
    if (this.workerConfig?.workerRuntime) {
      this.workerConfig.workerRuntime.stopHealthMonitoring();
    }
    this.workerConfig = null;
  }

  isWorkerMode(): boolean {
    return this.workerConfig?.mode === 'worker-backed' && this.workerConfig?.workerRuntime != null;
  }

  getWorkerRuntime(): WorkerRuntime | null {
    return this.workerConfig?.workerRuntime ?? null;
  }

  async synthesize(
    intent: string,
    extraParams?: Record<string, unknown>,
    onProgress?: (msg: string) => void
  ): Promise<SigmaForgeResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      onProgress?.('Analyzing intent...');
      const { template, params } = analyzeIntent(intent);
      const mergedParams = { ...params, ...(extraParams ?? {}) };

      onProgress?.(`Selected template: ${template.name}`);
      const { nodes, edges, phaseOrder } = decomposeTemplate(template, intent, mergedParams);

      onProgress?.('Building execution graph...');
      const graph = buildGraph(intent, template.name, nodes, edges, phaseOrder);

      const plan = buildPlanFromGraph(graph);

      const buildTask = `${graph.nodes.length} nodes, ${graph.edges.length} edges, ${phaseOrder.length} phases`;
      const contract = createContract(intent, buildTask, graph, plan);

      initControlState(graph.id);

      onProgress?.(`Executing DAG: ${graph.nodes.length} nodes in ${plan.totalPhases} parallel groups...`);

      // Use worker-backed handlers if worker mode is enabled
      const useWorkers = this.workerConfig?.mode === 'worker-backed' && this.workerConfig?.workerRuntime != null;

      let dagOptions: DAGRuntimeOptions;

      if (useWorkers) {
        const wr = this.workerConfig!.workerRuntime!;
        if (this.workerConfig!.autoBindContracts) {
          const workers = wr.getWorkers();
          for (const w of workers) {
            wr.bindContract(contract.id, w.id);
          }
        }
        dagOptions = createWorkerBackedDAGOptions(wr, graph.id, onProgress);
        dagOptions.controlCheck = checkControl;
      } else {
        dagOptions = {
          handlers: this.handlers,
          onNodeStart: (node) => onProgress?.(`  ▶ ${node.label} (${node.taskType})`),
          onNodeComplete: (node) => onProgress?.(`  ✓ ${node.label}`),
          onNodeFailed: (node, error) => onProgress?.(`  ✗ ${node.label}: ${error}`),
          controlCheck: checkControl
        };
      }

      const dagResult = await executeDAG(graph, dagOptions);

      const evidenceRefs = graph.nodes
        .filter(n => n.evidenceRef)
        .map(n => n.evidenceRef!);

      if (dagResult.success || graph.status === 'cancelled') {
        completeContract(contract, evidenceRefs);
      } else {
        failContract(contract);
      }

      // Emit worker dashboard snapshot if enabled
      if (useWorkers && this.workerConfig!.emitDashboardEvents) {
        const { emitWorkerDashboardSnapshot } = await import('../workers/worker-dashboard-events.js');
        await emitWorkerDashboardSnapshot(graph.id);
      }

      const result: SigmaForgeResult = {
        contract,
        graph,
        plan,
        errors,
        completed: dagResult.success,
        durationMs: Date.now() - startTime
      };

      this.results.push(result);
      pushResult(result);
      return result;

    } catch (err) {
      errors.push(String(err));
      const result: SigmaForgeResult = {
        contract: null,
        graph: null,
        plan: null,
        errors,
        completed: false,
        durationMs: Date.now() - startTime
      };
      this.results.push(result);
      pushResult(result);
      return result;
    }
  }

  async synthesizeFromIntent(
    intent: string,
    extraParams?: Record<string, unknown>
  ): Promise<SigmaForgeResult> {
    const messages: string[] = [];
    return this.synthesize(intent, extraParams, (msg) => { messages.push(msg); });
  }
}
