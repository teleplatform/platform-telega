export interface ResourceSnapshot {
  snapshotId: string;
  cpuPercent: number;
  ramPercent: number;
  ramFreeGb: number;
  ramTotalGb: number;
  swapPercent: number;
  swapUsedMb: number;
  diskFreeGb: number;
  activeJobs: number;
  activeAgents: number;
  activeRepairs: number;
  timestamp: number;
}

export interface ResourceBudget {
  budgetId: string;
  missionId: string;
  maxCostUsd: number;
  maxRamPercent: number;
  maxCpuPercent: number;
  maxConcurrentJobs: number;
  maxTokensPerDay: number;
  createdAt: number;
}

export interface ResourceDecision {
  allowed: boolean;
  reason: string;
  recommendation: string | null;
  snapshot: ResourceSnapshot | null;
  timestamp: number;
}

export interface ResourceAlert {
  alertId: string;
  severity: "info" | "warning" | "critical";
  metric: string;
  value: number;
  threshold: number;
  message: string;
  timestamp: number;
}
