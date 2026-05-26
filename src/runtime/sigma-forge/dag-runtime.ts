import { ExecutionGraph, GraphNode, RuntimePlan, CapabilityHandlerMap } from './sigma-forge-types.js';
import { getParallelGroups, updateNodeStatus, markGraphStatus } from './execution-graph.js';
import { getCapability } from './capability-registry.js';

let planCounter = 0;

function generatePlanId(): string {
  return `rp_${Date.now()}_${String(++planCounter).padStart(4, '0')}`;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface DAGRuntimeOptions {
  handlers: CapabilityHandlerMap;
  onNodeStart?: (node: GraphNode) => void;
  onNodeComplete?: (node: GraphNode) => void;
  onNodeFailed?: (node: GraphNode, error: string) => void;
  onGroupComplete?: (groupIndex: number, nodes: GraphNode[]) => void;
  controlCheck?: (graphId: string) => { paused: boolean; cancelled: boolean };
}

export interface DAGResult {
  success: boolean;
  groupsExecuted: number;
  nodesExecuted: number;
  nodesFailed: number;
  failedNodes: GraphNode[];
  completedNodes: GraphNode[];
}

export async function executeDAG(
  graph: ExecutionGraph,
  options: DAGRuntimeOptions
): Promise<DAGResult> {
  const { handlers, onNodeStart, onNodeComplete, onNodeFailed, onGroupComplete, controlCheck } = options;
  const parallelGroups = getParallelGroups(graph);

  markGraphStatus(graph, 'running');
  let totalExecuted = 0;
  let totalFailed = 0;
  const failedNodes: GraphNode[] = [];
  const completedNodes: GraphNode[] = [];

  for (let groupIdx = 0; groupIdx < parallelGroups.length; groupIdx++) {
    // Control check before each group
    if (controlCheck) {
      const ctrl = controlCheck(graph.id);
      if (ctrl.cancelled) {
        for (const g of parallelGroups.slice(groupIdx)) {
          for (const node of g) {
            if (node.status === 'pending' || node.status === 'ready' || node.status === 'running') {
              updateNodeStatus(graph, node.id, 'skipped', { completedAt: Date.now() });
            }
          }
        }
        markGraphStatus(graph, 'cancelled');
        return {
          success: false,
          groupsExecuted: groupIdx,
          nodesExecuted: totalExecuted,
          nodesFailed: totalFailed,
          failedNodes,
          completedNodes
        };
      }
      while (ctrl.paused && !ctrl.cancelled) {
        await delay(1000);
        const updated = controlCheck(graph.id);
        ctrl.paused = updated.paused;
        ctrl.cancelled = updated.cancelled;
        if (updated.cancelled) {
          for (const g of parallelGroups.slice(groupIdx)) {
            for (const node of g) {
              if (node.status === 'pending' || node.status === 'ready' || node.status === 'running') {
                updateNodeStatus(graph, node.id, 'skipped', { completedAt: Date.now() });
              }
            }
          }
          markGraphStatus(graph, 'cancelled');
          return {
            success: false,
            groupsExecuted: groupIdx,
            nodesExecuted: totalExecuted,
            nodesFailed: totalFailed,
            failedNodes,
            completedNodes
          };
        }
      }
    }

    const group = parallelGroups[groupIdx];

    const results = await Promise.allSettled(
      group.map(async (node) => {
        if (node.status === 'completed' || node.status === 'skipped') return;
        if (node.status === 'failed') {
          totalFailed++;
          failedNodes.push(node);
          return;
        }

        onNodeStart?.(node);
        updateNodeStatus(graph, node.id, 'running', {
          startedAt: Date.now()
        });

        const capability = getCapability(node.taskType);
        const handler = handlers[capability];

        if (!handler) {
          const err = `No handler registered for capability: ${capability} (task: ${node.taskType})`;
          updateNodeStatus(graph, node.id, 'failed', {
            error: err,
            completedAt: Date.now()
          });
          onNodeFailed?.(node, err);
          totalFailed++;
          failedNodes.push(node);
          return;
        }

        let lastError: string | null = null;
        for (let attempt = 0; attempt <= node.maxRetries; attempt++) {
          try {
            if (attempt > 0) {
              const backoff = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
              await delay(backoff);
            }
            const result = await handler(node);
            updateNodeStatus(graph, node.id, 'completed', {
              output: result.result,
              evidenceRef: result.evidence ?? null,
              retryCount: attempt,
              completedAt: Date.now(),
              startedAt: node.startedAt,
              durationMs: Date.now() - (node.startedAt ?? Date.now())
            });
            onNodeComplete?.(node);
            totalExecuted++;
            completedNodes.push(node);
            return;
          } catch (err) {
            lastError = String(err);
          }
        }

        updateNodeStatus(graph, node.id, 'failed', {
          error: lastError,
          retryCount: node.maxRetries,
          completedAt: Date.now(),
          durationMs: Date.now() - (node.startedAt ?? Date.now())
        });
        onNodeFailed?.(node, lastError ?? 'Unknown error');
        totalFailed++;
        failedNodes.push(node);
      })
    );

    onGroupComplete?.(groupIdx, group);
  }

  const success = totalFailed === 0;
  markGraphStatus(graph, success ? 'completed' : 'failed');

  return {
    success,
    groupsExecuted: parallelGroups.length,
    nodesExecuted: totalExecuted,
    nodesFailed: totalFailed,
    failedNodes,
    completedNodes
  };
}

export function buildPlanFromGraph(graph: ExecutionGraph): RuntimePlan {
  const groups = getParallelGroups(graph);
  return {
    id: generatePlanId(),
    graphId: graph.id,
    executionOrder: groups.map(g => g.map(n => n.id)),
    totalNodes: graph.nodes.length,
    totalPhases: groups.length
  };
}
