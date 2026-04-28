/**
 * Voice Cross-Domain Mission Planning & Execution Graph Layer v8.0
 *
 * First-class entity: VoiceMissionExecutionGraph
 *
 * This layer answers:
 *   - "How is a mission broken down into executable steps across domains?"
 *   - "What are the dependencies between mission steps?"
 *   - "What is the current execution status of the mission graph?"
 *
 * This layer does NOT:
 *   - define the mission intent (delegated to V7.9)
 *   - supervise execution (delegated to V8.1)
 *   - replan the graph (delegated to V8.2)
 *
 * RULE: NO MISSION EXECUTION WITHOUT EXPLICIT DEPENDENCY GRAPH
 */

import type { VoiceDomainType } from "./voiceDomainSegmentation.js";
import type { VoiceMissionType, VoiceGovernanceMission } from "./voiceMissionModel.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceMissionActionType =
  | "observe"
  | "validate"
  | "adapt"
  | "stabilize"
  | "review"
  | "rollback";

export type VoiceMissionExecutionMode =
  | "sequential"
  | "parallel_safe"
  | "strict_order";

export type VoiceMissionGraphStatus =
  | "draft"
  | "ready"
  | "running"
  | "paused"
  | "completed"
  | "failed";

export interface VoiceMissionGraphNode {
  nodeId: string;

  domainId: string;

  actionType: VoiceMissionActionType;

  dependsOn: string[]; // node IDs that must complete before this node

  // Metadata
  description: string;
  estimatedDurationMs?: number;
  priority: number; // 1..10, higher = more important

  // Execution tracking
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt?: number;
  completedAt?: number;
  failureReason?: string;
}

export interface VoiceMissionExecutionGraph {
  graphId: string;

  missionId: string;

  nodes: VoiceMissionGraphNode[];

  executionMode: VoiceMissionExecutionMode;

  graphStatus: VoiceMissionGraphStatus;

  createdAt: number;

  // Execution tracking
  startedAt?: number;
  completedAt?: number;
  failedAt?: number;
  failureReason?: string;

  // Metadata
  version: number;
  previousGraphId?: string; // if this is a replanned graph
}

export type VoiceMissionGraphValidationError =
  | "no_nodes"
  | "duplicate_node_ids"
  | "invalid_dependency"
  | "circular_dependency"
  | "node_domain_missing"
  | "node_action_type_invalid";

// ============================================================================
// ID generation
// ============================================================================

function generateGraphId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_graph_${timestamp}_${random}`;
}

function generateNodeId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(2);
  return `node_${timestamp}_${random}`;
}

function cryptoRandomHex(bytes: number): string {
  try {
    const { randomBytes } = require("node:crypto");
    return randomBytes(bytes).toString("hex");
  } catch {
    return Math.random().toString(16).slice(2, 2 + bytes * 2);
  }
}

// ============================================================================
// Validation
// ============================================================================

export function validateMissionGraph(
  graph: Partial<VoiceMissionExecutionGraph>,
): VoiceMissionGraphValidationError[] {
  const errors: VoiceMissionGraphValidationError[] = [];

  if (!graph.nodes || graph.nodes.length === 0) {
    errors.push("no_nodes");
    return errors; // can't validate further without nodes
  }

  // Check for duplicate node IDs
  const nodeIds = graph.nodes.map((n) => n.nodeId);
  if (new Set(nodeIds).size !== nodeIds.length) {
    errors.push("duplicate_node_ids");
  }

  // Check each node
  for (const node of graph.nodes) {
    if (!node.domainId) {
      errors.push("node_domain_missing");
    }

    if (!node.actionType) {
      errors.push("node_action_type_invalid");
    }
  }

  // Check dependencies
  const nodeIdSet = new Set(nodeIds);
  for (const node of graph.nodes) {
    for (const dep of node.dependsOn) {
      if (!nodeIdSet.has(dep)) {
        errors.push("invalid_dependency");
        break;
      }
    }
  }

  // Check for circular dependencies
  if (hasCircularDependency(graph.nodes)) {
    errors.push("circular_dependency");
  }

  return errors;
}

function hasCircularDependency(nodes: VoiceMissionGraphNode[]): boolean {
  // Topological sort (Kahn's algorithm) to detect cycles
  const inDegree = new Map<string, number>();
  const adjacencyList = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.nodeId, 0);
    adjacencyList.set(node.nodeId, []);
  }

  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      adjacencyList.get(dep)?.push(node.nodeId);
      inDegree.set(node.nodeId, (inDegree.get(node.nodeId) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  let visitedCount = 0;
  while (queue.length > 0) {
    const current = queue.shift()!;
    visitedCount++;

    for (const neighbor of adjacencyList.get(current) || []) {
      inDegree.set(neighbor, inDegree.get(neighbor)! - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  return visitedCount !== nodes.length;
}

// ============================================================================
// Execution mode determination from mission type
// ============================================================================

function determineExecutionMode(
  missionType: VoiceMissionType,
  nodeCount: number,
): VoiceMissionExecutionMode {
  // Crisis recovery requires strict ordering
  if (missionType === "recover_from_crisis") {
    return "strict_order";
  }

  // Stabilization and risk reduction prefer strict ordering for safety
  if (missionType === "stabilize_system" || missionType === "reduce_risk") {
    return nodeCount > 5 ? "strict_order" : "sequential";
  }

  // Learning quality improvement can be parallel-safe
  if (missionType === "improve_learning_quality") {
    return "parallel_safe";
  }

  // Growth preparation can be parallel-safe
  if (missionType === "prepare_growth_mode") {
    return "parallel_safe";
  }

  return "sequential";
}

// ============================================================================
// Graph building helpers
// ============================================================================

export interface VoiceMissionGraphInput {
  mission: VoiceGovernanceMission;
  nodeTemplates: Array<{
    domainId: string;
    actionType: VoiceMissionActionType;
    description: string;
    dependsOn?: number[]; // indices into the nodeTemplates array
    estimatedDurationMs?: number;
    priority?: number;
  }>;
}

/**
 * Build an execution graph from a mission and node templates.
 * Pure function — constructs nodes and validates the graph.
 */
export function buildVoiceMissionExecutionGraph(
  input: VoiceMissionGraphInput,
): {
  graph: VoiceMissionExecutionGraph;
  validationErrors: VoiceMissionGraphValidationError[];
} {
  // Build nodes from templates
  const nodeIds: string[] = input.nodeTemplates.map(() => generateNodeId());

  const nodes: VoiceMissionGraphNode[] = input.nodeTemplates.map(
    (template, index) => {
      const dependsOn = (template.dependsOn || []).map(
        (idx) => nodeIds[idx],
      );

      return {
        nodeId: nodeIds[index],
        domainId: template.domainId,
        actionType: template.actionType,
        dependsOn,
        description: template.description,
        estimatedDurationMs: template.estimatedDurationMs,
        priority: template.priority ?? 5,
        status: "pending",
      };
    },
  );

  const executionMode = determineExecutionMode(
    input.mission.missionType,
    nodes.length,
  );

  const graph: VoiceMissionExecutionGraph = {
    graphId: generateGraphId(),
    missionId: input.mission.missionId,
    nodes,
    executionMode,
    graphStatus: "draft",
    createdAt: Date.now(),
    version: 1,
  };

  const validationErrors = validateMissionGraph(graph);

  return { graph, validationErrors };
}

// ============================================================================
// Graph lifecycle management
// ============================================================================

export function readyVoiceGraph(
  graph: VoiceMissionExecutionGraph,
): VoiceMissionExecutionGraph {
  if (graph.graphStatus !== "draft") {
    return graph;
  }

  const errors = validateMissionGraph(graph);
  if (errors.length > 0) {
    return {
      ...graph,
      graphStatus: "draft",
      failureReason: `Graph not ready: ${errors.join(", ")}`,
    };
  }

  return {
    ...graph,
    graphStatus: "ready",
  };
}

export function startVoiceGraph(
  graph: VoiceMissionExecutionGraph,
): VoiceMissionExecutionGraph {
  if (graph.graphStatus !== "ready") {
    return graph;
  }

  return {
    ...graph,
    graphStatus: "running",
    startedAt: Date.now(),
  };
}

export function pauseVoiceGraph(
  graph: VoiceMissionExecutionGraph,
): VoiceMissionExecutionGraph {
  if (graph.graphStatus !== "running") {
    return graph;
  }

  return {
    ...graph,
    graphStatus: "paused",
  };
}

export function resumeVoiceGraph(
  graph: VoiceMissionExecutionGraph,
): VoiceMissionExecutionGraph {
  if (graph.graphStatus !== "paused") {
    return graph;
  }

  return {
    ...graph,
    graphStatus: "running",
  };
}

export function completeVoiceGraph(
  graph: VoiceMissionExecutionGraph,
): VoiceMissionExecutionGraph {
  if (graph.graphStatus !== "running") {
    return graph;
  }

  // Check all nodes completed
  const allCompleted = graph.nodes.every(
    (n) => n.status === "completed" || n.status === "skipped",
  );

  if (!allCompleted) {
    return graph;
  }

  return {
    ...graph,
    graphStatus: "completed",
    completedAt: Date.now(),
  };
}

export function failVoiceGraph(
  graph: VoiceMissionExecutionGraph,
  reason: string,
): VoiceMissionExecutionGraph {
  return {
    ...graph,
    graphStatus: "failed",
    failedAt: Date.now(),
    failureReason: reason,
  };
}

// ============================================================================
// Node execution management
// ============================================================================

export function startGraphNode(
  graph: VoiceMissionExecutionGraph,
  nodeId: string,
): VoiceMissionExecutionGraph {
  const nodes: VoiceMissionGraphNode[] = graph.nodes.map((n) => {
    if (n.nodeId === nodeId) {
      // Check dependencies are met
      const depsMet = n.dependsOn.every((depId) => {
        const depNode = graph.nodes.find((x) => x.nodeId === depId);
        return depNode && (depNode.status === "completed" || depNode.status === "skipped");
      });

      if (!depsMet) {
        return n; // cannot start — dependencies not met
      }

      return { ...n, status: "running" as const, startedAt: Date.now() };
    }
    return n;
  });

  return { ...graph, nodes };
}

export function completeGraphNode(
  graph: VoiceMissionExecutionGraph,
  nodeId: string,
): VoiceMissionExecutionGraph {
  const nodes: VoiceMissionGraphNode[] = graph.nodes.map((n) => {
    if (n.nodeId === nodeId) {
      return { ...n, status: "completed" as const, completedAt: Date.now() };
    }
    return n;
  });

  return { ...graph, nodes };
}

export function failGraphNode(
  graph: VoiceMissionExecutionGraph,
  nodeId: string,
  reason: string,
): VoiceMissionExecutionGraph {
  const nodes: VoiceMissionGraphNode[] = graph.nodes.map((n) => {
    if (n.nodeId === nodeId) {
      return { ...n, status: "failed" as const, failureReason: reason, completedAt: Date.now() };
    }
    return n;
  });

  return { ...graph, nodes };
}

export function skipGraphNode(
  graph: VoiceMissionExecutionGraph,
  nodeId: string,
  reason: string,
): VoiceMissionExecutionGraph {
  const nodes: VoiceMissionGraphNode[] = graph.nodes.map((n) => {
    if (n.nodeId === nodeId) {
      return { ...n, status: "skipped" as const, failureReason: reason, completedAt: Date.now() };
    }
    return n;
  });

  return { ...graph, nodes };
}

// ============================================================================
// Graph analysis
// ============================================================================

/**
 * Get nodes that are ready to execute (all dependencies met).
 */
export function getReadyNodes(
  graph: VoiceMissionExecutionGraph,
): VoiceMissionGraphNode[] {
  return graph.nodes.filter((node) => {
    if (node.status !== "pending") return false;

    return node.dependsOn.every((depId) => {
      const depNode = graph.nodes.find((n) => n.nodeId === depId);
      return depNode && (depNode.status === "completed" || depNode.status === "skipped");
    });
  });
}

/**
 * Get nodes that are currently blocked (dependencies not met).
 */
export function getBlockedNodes(
  graph: VoiceMissionExecutionGraph,
): VoiceMissionGraphNode[] {
  return graph.nodes.filter((node) => {
    if (node.status !== "pending") return false;

    return node.dependsOn.some((depId) => {
      const depNode = graph.nodes.find((n) => n.nodeId === depId);
      return !depNode || depNode.status === "pending" || depNode.status === "running";
    });
  });
}

/**
 * Calculate graph progress percentage.
 */
export function calculateGraphProgress(
  graph: VoiceMissionExecutionGraph,
): number {
  if (graph.nodes.length === 0) return 0;

  const completedCount = graph.nodes.filter(
    (n) => n.status === "completed" || n.status === "skipped",
  ).length;

  return Math.round((completedCount / graph.nodes.length) * 100);
}

// ============================================================================
// Graph registry
// ============================================================================

export interface VoiceMissionGraphRegistry {
  graphs: Map<string, VoiceMissionExecutionGraph>;
  maxGraphs: number;
}

const DEFAULT_GRAPH_MAX_REGISTRY = 50;

let _graphRegistry: VoiceMissionGraphRegistry = {
  graphs: new Map(),
  maxGraphs: DEFAULT_GRAPH_MAX_REGISTRY,
};

export function getVoiceMissionGraphRegistry(): VoiceMissionGraphRegistry {
  return {
    graphs: new Map(_graphRegistry.graphs),
    maxGraphs: _graphRegistry.maxGraphs,
  };
}

export function registerVoiceMissionGraph(
  graph: VoiceMissionExecutionGraph,
): void {
  if (_graphRegistry.graphs.size >= _graphRegistry.maxGraphs) {
    throw new Error(
      `Graph registry full (max ${_graphRegistry.maxGraphs}). Cannot register ${graph.graphId}`,
    );
  }
  _graphRegistry.graphs.set(graph.graphId, graph);
}

export function getVoiceMissionGraph(
  graphId: string,
): VoiceMissionExecutionGraph | undefined {
  return _graphRegistry.graphs.get(graphId);
}

export function getGraphsForMission(
  missionId: string,
): VoiceMissionExecutionGraph[] {
  return Array.from(_graphRegistry.graphs.values()).filter(
    (g) => g.missionId === missionId,
  );
}

export function removeVoiceMissionGraph(graphId: string): boolean {
  return _graphRegistry.graphs.delete(graphId);
}

export function clearVoiceMissionGraphRegistry(): void {
  _graphRegistry = {
    graphs: new Map(),
    maxGraphs: DEFAULT_GRAPH_MAX_REGISTRY,
  };
}

export function setVoiceMissionGraphRegistryForTest(
  registry: VoiceMissionGraphRegistry,
): void {
  _graphRegistry = registry;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceMissionGraphNode(node: VoiceMissionGraphNode): string {
  const statusEmoji: Record<VoiceMissionGraphNode["status"], string> = {
    pending: "⏳",
    running: "▶️",
    completed: "✅",
    failed: "❌",
    skipped: "⏭️",
  };

  const deps = node.dependsOn.length > 0 ? ` deps=[${node.dependsOn.join(", ")}]` : "";
  const duration = node.estimatedDurationMs
    ? ` est=${node.estimatedDurationMs}ms`
    : "";

  return `  ${statusEmoji[node.status]} ${node.nodeId}: ${node.actionType} @ ${node.domainId} [p=${node.priority}]${deps}${duration} — ${node.description}`;
}

export function formatVoiceMissionExecutionGraph(
  graph: VoiceMissionExecutionGraph,
): string {
  const statusEmoji: Record<VoiceMissionGraphStatus, string> = {
    draft: "📝",
    ready: "✅",
    running: "🚀",
    paused: "⏸️",
    completed: "✅",
    failed: "❌",
  };

  const progress = calculateGraphProgress(graph);

  const lines = [
    `📊 Voice Mission Execution Graph`,
    `• graph ID: ${graph.graphId}`,
    `• mission ID: ${graph.missionId}`,
    `• status: ${statusEmoji[graph.graphStatus]} ${graph.graphStatus}`,
    `• execution mode: ${graph.executionMode}`,
    `• progress: ${progress}% (${graph.nodes.filter((n) => n.status === "completed" || n.status === "skipped").length}/${graph.nodes.length} nodes)`,
    `• version: ${graph.version}`,
    `• created at: ${new Date(graph.createdAt).toISOString()}`,
    `--- Nodes (${graph.nodes.length}) ---`,
  ];

  for (const node of graph.nodes) {
    lines.push(formatVoiceMissionGraphNode(node));
  }

  if (graph.startedAt) {
    lines.push(`• started at: ${new Date(graph.startedAt).toISOString()}`);
  }

  if (graph.completedAt) {
    lines.push(`• completed at: ${new Date(graph.completedAt).toISOString()}`);
  }

  if (graph.failedAt) {
    lines.push(`• failed at: ${new Date(graph.failedAt).toISOString()}`);
    if (graph.failureReason) {
      lines.push(`• failure reason: ${graph.failureReason}`);
    }
  }

  if (graph.previousGraphId) {
    lines.push(`• previous graph: ${graph.previousGraphId}`);
  }

  return lines.join("\n");
}
