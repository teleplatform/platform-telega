export interface AgentCard {
  agentId: string;
  name: string;
  role: string;
  status: "idle" | "busy" | "completed" | "failed";
  currentTask: string | null;
  provider: string | null;
  uptimeMs: number;
}

export interface ProviderHealthCard {
  provider: string;
  status: "active" | "degraded" | "down";
  accountsTotal: number;
  accountsActive: number;
  accountsCooldown: number;
  accountsAuthIssues: number;
  lastError: string | null;
}

export interface SpaceCard {
  spaceId: string;
  name: string;
  description: string;
  agentCount: number;
  activeTasks: number;
  missionId: string | null;
}

export interface RunningTaskCard {
  taskId: string;
  title: string;
  agentName: string;
  agentRole: string;
  startedAt: number;
  durationMs: number;
  status: "running" | "stale" | "failed";
}

export interface EvidenceFeedItem {
  evidenceId: string;
  event: string;
  summary: string;
  source: string;
  trusted: boolean;
  timestamp: string;
}

export interface ACCSummary {
  totalAgents: number;
  activeAgents: number;
  runningTasks: number;
  degradedProviders: number;
  staleRuns: number;
}

export interface AgentCommandCenter {
  summary: ACCSummary;
  agents: AgentCard[];
  providers: ProviderHealthCard[];
  spaces: SpaceCard[];
  tasks: RunningTaskCard[];
  evidence: EvidenceFeedItem[];
}
