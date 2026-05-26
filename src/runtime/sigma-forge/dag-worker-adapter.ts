import type { CapabilityHandler, CapabilityHandlerMap, GraphNode } from './sigma-forge-types.js';
import type { WorkerRuntime } from '../workers/worker-runtime.js';

export interface WorkerBackedHandlersOptions {
  workerRuntime: WorkerRuntime;
  graphId: string;
  emitEvents?: boolean;
}

export function createWorkerBackedHandlers(options: WorkerBackedHandlersOptions): CapabilityHandlerMap {
  const { workerRuntime, graphId } = options;

  const handler: CapabilityHandler = async (node: GraphNode) => {
    const result = await workerRuntime.executeNode(node, graphId);
    return {
      result: result.output,
      evidence: result.evidence ?? undefined
    };
  };

  const allCapabilities = [
    'browser', 'memory', 'execution', 'evidence', 'governance', 'goals', 'forge'
  ];

  const handlers: CapabilityHandlerMap = {};
  for (const cap of allCapabilities) {
    handlers[cap] = handler;
  }

  return handlers;
}

export function createWorkerBackedDAGOptions(
  workerRuntime: WorkerRuntime,
  graphId: string,
  onProgress?: (msg: string) => void
): { handlers: CapabilityHandlerMap; onNodeStart?: (node: GraphNode) => void; onNodeComplete?: (node: GraphNode) => void; onNodeFailed?: (node: GraphNode, error: string) => void } {
  const handlers = createWorkerBackedHandlers({ workerRuntime, graphId, emitEvents: true });

  return {
    handlers,
    onNodeStart: (node) => onProgress?.(`  ▶ [worker] ${node.label} (${node.taskType})`),
    onNodeComplete: (node) => onProgress?.(`  ✓ [worker] ${node.label}`),
    onNodeFailed: (node, error) => onProgress?.(`  ✗ [worker] ${node.label}: ${error}`)
  };
}
