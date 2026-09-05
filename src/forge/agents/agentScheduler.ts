import { AgentProfile, AgentRole, AgentAssignment, AgentCapability } from "./agentTypes";
import { AgentRegistry } from "./agentRegistry";

const assignments = new Map<string, AgentAssignment>();

let acounter = 0;
function genId(): string {
  acounter++;
  return `assign_${Date.now()}_${acounter}`;
}

function matchCapability(agent: AgentProfile, required: string): boolean {
  return agent.capabilities.some((c) => c.name.toLowerCase().includes(required.toLowerCase()) || required.toLowerCase().includes(c.name.toLowerCase()));
}

function findAgent(role: AgentRole, requiredCapability?: string): AgentProfile | undefined {
  const candidates = AgentRegistry.listByRole(role).filter((a) => a.status === "idle");

  if (requiredCapability) {
    return candidates.find((a) => matchCapability(a, requiredCapability)) || candidates[0];
  }

  return candidates[0];
}

export function scheduleJob(
  jobNodeId: string,
  jobGraphId: string,
  taskTitle: string,
  requiredRole: AgentRole,
  requiredCapability?: string
): AgentAssignment | null {
  const agent = findAgent(requiredRole, requiredCapability);
  if (!agent) return null;

  AgentRegistry.updateStatus(agent.id, "busy");

  const assignment: AgentAssignment = {
    id: genId(),
    agentId: agent.id,
    agentRole: agent.role,
    jobNodeId,
    jobGraphId,
    taskTitle,
    status: "assigned",
    startedAt: null,
    completedAt: null,
    result: null,
    error: null,
    evidence: [],
  };

  assignments.set(assignment.id, assignment);
  return assignment;
}

export function scheduleParallel(
  nodes: Array<{ id: string; title: string; role: AgentRole; capability?: string }>,
  graphId: string
): { assignments: AgentAssignment[]; unassigned: string[] } {
  const results: AgentAssignment[] = [];
  const unassigned: string[] = [];

  for (const node of nodes) {
    const assignment = scheduleJob(node.id, graphId, node.title, node.role, node.capability);
    if (assignment) {
      results.push(assignment);
    } else {
      unassigned.push(node.id);
    }
  }

  return { assignments: results, unassigned };
}

export function getAssignment(id: string): AgentAssignment | undefined {
  return assignments.get(id);
}

export function getAssignmentsByGraph(graphId: string): AgentAssignment[] {
  return Array.from(assignments.values()).filter((a) => a.jobGraphId === graphId);
}

export function getAssignmentsByAgent(agentId: string): AgentAssignment[] {
  return Array.from(assignments.values()).filter((a) => a.agentId === agentId);
}

export function updateAssignment(
  id: string,
  updates: Partial<AgentAssignment>
): AgentAssignment | null {
  const existing = assignments.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id };
  assignments.set(id, updated);

  // Update agent status based on assignment status
  if (updates.status === "completed") {
    AgentRegistry.updateStatus(existing.agentId, "idle");
  } else if (updates.status === "failed") {
    AgentRegistry.updateStatus(existing.agentId, "failed");
  }

  return updated;
}
