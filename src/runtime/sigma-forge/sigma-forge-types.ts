export type RuntimeCapability =
  | 'browser'
  | 'memory'
  | 'execution'
  | 'evidence'
  | 'governance'
  | 'goals'
  | 'forge';

export type TaskType =
  | 'browser.navigate'
  | 'browser.click'
  | 'browser.type'
  | 'browser.extract'
  | 'browser.screenshot'
  | 'browser.wait'
  | 'browser.search'
  | 'browser.verify_condition'
  | 'memory.store'
  | 'memory.retrieve'
  | 'memory.search'
  | 'execution.shell'
  | 'execution.http'
  | 'execution.file_read'
  | 'execution.file_write'
  | 'execution.verify'
  | 'evidence.record'
  | 'evidence.verify'
  | 'evidence.export'
  | 'governance.check'
  | 'goals.create'
  | 'goals.update'
  | 'goals.complete'
  | 'artifact.register'
  | 'mission.summary';

export type NodeStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'skipped';

export interface GraphNode {
  id: string;
  taskType: TaskType;
  capability: RuntimeCapability;
  label: string;
  params: Record<string, unknown>;
  phase: string;
  status: NodeStatus;
  maxRetries: number;
  retryCount: number;
  output: unknown;
  error: string | null;
  checkpointId: string | null;
  traceId: string | null;
  evidenceRef: string | null;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown>;
}

export type EdgeType = 'data' | 'ordering' | 'verification';

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  dataMapping: Record<string, string> | null;
}

export type GraphStatus = 'draft' | 'ready' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionGraph {
  id: string;
  name: string;
  intent: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  createdAt: number;
  updatedAt: number;
  status: GraphStatus;
  phaseOrder: string[];
  metadata: Record<string, unknown>;
}

export interface PhaseTaskDef {
  taskType: TaskType;
  label: string;
  params: Record<string, unknown>;
  maxRetries: number;
}

export interface PhaseDefinition {
  name: string;
  description: string;
  tasks: PhaseTaskDef[];
  dependencies: string[];
}

export interface IntentTemplate {
  name: string;
  keywords: string[];
  phases: PhaseDefinition[];
  priority: number;
}

export interface CapabilityRoute {
  capability: RuntimeCapability;
  taskType: TaskType;
  handler: string;
}

export type CapabilityHandler = (node: GraphNode) => Promise<{ result: unknown; evidence?: string }>;

export interface CapabilityHandlerMap {
  [capability: string]: CapabilityHandler;
}

export interface RuntimeContract {
  id: string;
  intent: string;
  buildTask: string;
  executionGraphId: string;
  runtimePlanId: string;
  verifiedExecution: boolean;
  evidenceRefs: string[];
  createdAt: number;
  completedAt: number | null;
  status: 'active' | 'completed' | 'failed';
}

export interface RuntimePlan {
  id: string;
  graphId: string;
  executionOrder: string[][];
  totalNodes: number;
  totalPhases: number;
}

export interface SigmaForgeResult {
  contract: RuntimeContract | null;
  graph: ExecutionGraph | null;
  plan: RuntimePlan | null;
  errors: string[];
  completed: boolean;
  durationMs: number;
}
