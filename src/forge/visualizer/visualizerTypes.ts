export interface VisualizerNode {
  id: string;
  taskId: string;
  title: string;
  status: string;
  level: number;
  priority: string;
  agentId: string | null;
  providerId: string | null;
  evidenceCount: number;
  hasVerification: boolean;
  hasRecoveryPlan: boolean;
  hasGovernanceDecision: boolean;
  hasArtifacts: boolean;
}

export interface VisualizerEdge {
  from: string;
  to: string;
  type: string;
}

export interface VisualizerLevel {
  index: number;
  nodes: VisualizerNode[];
  label: string;
}

export interface GraphVisualizer {
  graphId: string;
  graphName: string;
  graphStatus: string;
  nodes: VisualizerNode[];
  edges: VisualizerEdge[];
  levels: VisualizerLevel[];
  blockers: string[];
  totalNodes: number;
  totalEdges: number;
  levelCount: number;
  completedCount: number;
  failedCount: number;
  blockedCount: number;
  runningCount: number;
  generatedAt: string;
}
