export type AgentModuleId =
  | "spyglass"
  | "t800";

export type AgentStatus =
  | "planned"
  | "placeholder"
  | "active"
  | "disabled";

export type AgentExecutionState =
  | "idle"
  | "running"
  | "waiting"
  | "failed"
  | "done";

export type AgentTask = {
  id: string;
  agentId: AgentModuleId;
  goal: string;
  state: AgentExecutionState;
  createdAt: number;
  updatedAt: number;
  contextRef?: string | null;
  resultRef?: string | null;
};

export type AgentModuleConfig = {
  id: AgentModuleId;
  title: string;
  status: AgentStatus;
  role:
    | "research"
    | "execution";
  visibility: "creator" | "internal";
};

export interface AgentRuntime {
  submit(task: AgentTask): Promise<AgentTask>;
}
