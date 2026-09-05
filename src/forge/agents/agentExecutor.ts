import { AgentAssignment, AgentResult } from "./agentTypes";
import { updateAssignment } from "./agentScheduler";

export function executeJob(assignment: AgentAssignment): AgentResult {
  const startTime = Date.now();

  // Update to running
  updateAssignment(assignment.id, { status: "running", startedAt: startTime });

  // For v1, simulate execution (real execution will call actual agent runtime)
  // In production, this would call the appropriate agent handler
  const simulatedOutput = `[${assignment.agentRole}] Executed: ${assignment.taskTitle}`;

  const durationMs = Date.now() - startTime;

  const result: AgentResult = {
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    agentRole: assignment.agentRole,
    jobNodeId: assignment.jobNodeId,
    status: "completed",
    artifacts: [],
    evidence: [
      { kind: "agent.execution", data: { agentRole: assignment.agentRole, job: assignment.taskTitle, status: "completed" } },
      { kind: "agent.duration", data: { durationMs } },
    ],
    output: simulatedOutput,
    durationMs,
  };

  updateAssignment(assignment.id, {
    status: "completed",
    completedAt: Date.now(),
    result: simulatedOutput,
    evidence: result.evidence,
  });

  return result;
}

export function executeBatch(assignments: AgentAssignment[]): AgentResult[] {
  return assignments.map((a) => executeJob(a));
}

export function failAssignment(assignment: AgentAssignment, error: string): AgentResult {
  const durationMs = Date.now() - (assignment.startedAt || Date.now());

  updateAssignment(assignment.id, {
    status: "failed",
    completedAt: Date.now(),
    error,
  });

  return {
    assignmentId: assignment.id,
    agentId: assignment.agentId,
    agentRole: assignment.agentRole,
    jobNodeId: assignment.jobNodeId,
    status: "failed",
    artifacts: [],
    evidence: [{ kind: "agent.failure", data: { error } }],
    output: "",
    durationMs,
  };
}
