export type AgentRole =
  | "planner" | "researcher" | "coder" | "designer"
  | "tester" | "verifier" | "reporter";

export type AgentStatus =
  | "idle" | "busy" | "completed" | "failed";

export interface AgentCapability {
  name: string;
  description: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: AgentRole;
  capabilities: AgentCapability[];
  status: AgentStatus;
  createdAt: number;
}

export interface AgentAssignment {
  id: string;
  agentId: string;
  agentRole: AgentRole;
  jobNodeId: string;
  jobGraphId: string;
  taskTitle: string;
  status: "assigned" | "running" | "completed" | "failed";
  startedAt: number | null;
  completedAt: number | null;
  result: string | null;
  error: string | null;
  evidence: Array<{ kind: string; data: unknown }>;
}

export interface AgentResult {
  assignmentId: string;
  agentId: string;
  agentRole: AgentRole;
  jobNodeId: string;
  status: "completed" | "failed";
  artifacts: string[];
  evidence: Array<{ kind: string; data: unknown }>;
  output: string;
  durationMs: number;
}
