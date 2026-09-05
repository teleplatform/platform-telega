import { JobRegistry, startJob, completeJob, failJob, getExecutionOrder } from "../job/index.js";
import { AgentRegistry } from "./agentRegistry.js";
import { scheduleParallel, getAssignmentsByGraph, updateAssignment } from "./agentScheduler.js";
import { executeBatch, failAssignment } from "./agentExecutor.js";
import { AgentRole } from "./agentTypes.js";

const ROLE_MAP: Record<string, AgentRole> = {
  planner: "planner",
  researcher: "researcher",
  coder: "coder",
  designer: "designer",
  tester: "tester",
  verifier: "verifier",
  reporter: "reporter",
};

export async function executeGraph(graphId: string): Promise<{
  graphId: string;
  levels: number;
  assignments: number;
  completed: number;
  failed: number;
}> {
  const graph = JobRegistry.get(graphId);
  if (!graph) throw new Error(`Graph ${graphId} not found`);

  let totalAssignments = 0;
  let totalCompleted = 0;
  let totalFailed = 0;

  // Get execution order (levels)
  const levels = getExecutionOrder(graph);

  for (const level of levels) {
    // Prepare nodes for scheduling
    const nodes = level.map((node) => {
      const agentRole = ROLE_MAP[node.agentId] || "coder";
      return {
        id: node.id,
        title: node.title,
        role: agentRole,
        capability: node.title.toLowerCase().includes("test") ? "testing"
          : node.title.toLowerCase().includes("deploy") ? "deployment"
          : node.title.toLowerCase().includes("db") ? "database"
          : undefined,
      };
    });

    // Schedule parallel execution
    const { assignments, unassigned } = scheduleParallel(nodes, graphId);
    totalAssignments += assignments.length;

    // Execute all assigned jobs in parallel
    const results = executeBatch(assignments);

    for (const result of results) {
      if (result.status === "completed") {
        completeJob(graphId, result.jobNodeId, result.output);
        totalCompleted++;
      } else {
        failJob(graphId, result.jobNodeId, result.output);
        totalFailed++;
      }
    }

    // Handle unassigned nodes (no agent available)
    for (const nodeId of unassigned) {
      failJob(graphId, nodeId, "No available agent");
      totalFailed++;
    }
  }

  return {
    graphId,
    levels: levels.length,
    assignments: totalAssignments,
    completed: totalCompleted,
    failed: totalFailed,
  };
}

export function registerDefaultAgents(): void {
  const defaultAgents: Array<{ name: string; role: AgentRole; capabilities: string[] }> = [
    { name: "Planner Agent", role: "planner", capabilities: ["planning", "architecture", "design"] },
    { name: "Coder Agent", role: "coder", capabilities: ["coding", "typescript", "python", "patch"] },
    { name: "Designer Agent", role: "designer", capabilities: ["ui", "ux", "css", "design"] },
    { name: "Tester Agent", role: "tester", capabilities: ["testing", "verification", "qa"] },
    { name: "Verifier Agent", role: "verifier", capabilities: ["review", "quality", "lint"] },
    { name: "Researcher Agent", role: "researcher", capabilities: ["research", "documentation", "analysis"] },
  ];

  for (const a of defaultAgents) {
    AgentRegistry.register(a.name, a.role, a.capabilities.map((c) => ({ name: c, description: c })));
  }
}
