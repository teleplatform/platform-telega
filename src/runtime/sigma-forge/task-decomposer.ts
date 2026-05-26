import { PhaseDefinition, GraphNode, GraphEdge, IntentTemplate, TaskType, RuntimeCapability } from './sigma-forge-types.js';

let nodeCounter = 0;

function generateNodeId(): string {
  return `sn_${Date.now()}_${String(++nodeCounter).padStart(4, '0')}`;
}

function generateEdgeId(from: string, to: string): string {
  return `se_${from}_${to}`;
}

function getCapabilityForTaskType(taskType: TaskType): RuntimeCapability {
  if (taskType.startsWith('browser.')) return 'browser';
  if (taskType.startsWith('memory.')) return 'memory';
  if (taskType.startsWith('execution.')) return 'execution';
  if (taskType.startsWith('evidence.')) return 'evidence';
  if (taskType.startsWith('governance.')) return 'governance';
  if (taskType.startsWith('goals.')) return 'goals';
  if (taskType === 'artifact.register') return 'evidence';
  if (taskType === 'mission.summary') return 'evidence';
  return 'execution';
}

export interface DecompositionResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  phaseOrder: string[];
}

export function decomposeTemplate(
  template: IntentTemplate,
  intent: string,
  params: Record<string, unknown>
): DecompositionResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const phaseOrder: string[] = [];

  const phaseNodeMap = new Map<string, string[]>();

  for (const phase of template.phases) {
    phaseOrder.push(phase.name);
    const phaseNodeIds: string[] = [];

    for (const taskDef of phase.tasks) {
      const nodeId = generateNodeId();
      const mergedParams = { ...taskDef.params, ...params, _phase: phase.name };

      nodes.push({
        id: nodeId,
        taskType: taskDef.taskType,
        capability: getCapabilityForTaskType(taskDef.taskType),
        label: taskDef.label,
        params: mergedParams,
        phase: phase.name,
        status: 'pending',
        maxRetries: taskDef.maxRetries,
        retryCount: 0,
        output: null,
        error: null,
        checkpointId: null,
        traceId: null,
        evidenceRef: null,
        startedAt: null,
        completedAt: null,
        durationMs: null,
        metadata: {}
      });

      phaseNodeIds.push(nodeId);
    }

    phaseNodeMap.set(phase.name, phaseNodeIds);
  }

  for (const phase of template.phases) {
    for (const dep of phase.dependencies) {
      const depNodeIds = phaseNodeMap.get(dep);
      const phaseNodeIds = phaseNodeMap.get(phase.name);
      if (depNodeIds && phaseNodeIds) {
        for (const from of depNodeIds) {
          for (const to of phaseNodeIds) {
            edges.push({
              id: generateEdgeId(from, to),
              from,
              to,
              type: 'ordering',
              dataMapping: null
            });
          }
        }
      }
    }
  }

  return { nodes, edges, phaseOrder };
}
