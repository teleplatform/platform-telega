import type { PlanMode, NodeStatus, RiskClass, EdgeKind } from "./skillUnit.js";

export interface ExecutionGraph {
  graph_id: string;
  run_id: string;
  version: number;
  plan_mode: PlanMode;
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  entry_nodes: string[];
  terminal_nodes: string[];
}

export interface ExecutionNode {
  node_id: string;
  skill_id: string;
  title: string;
  status: NodeStatus;
  input_refs: string[];
  output_refs: string[];
  dependency_ids: string[];
  validator_hooks: string[];
  retry_count: number;
  max_retries: number;
  fallback_skill_id?: string;
  risk_class: RiskClass;
}

export interface ExecutionEdge {
  from_node_id: string;
  to_node_id: string;
  kind: EdgeKind;
}
