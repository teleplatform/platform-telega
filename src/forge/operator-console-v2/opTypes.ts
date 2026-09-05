export interface OPPanel {
  id: string;
  title: string;
  icon: string;
  metrics: Array<{ label: string; value: number | string; severity?: "ok" | "warning" | "critical" }>;
}

export interface OPConsole {
  panels: OPPanel[];
  summary: {
    totalMissions: number;
    totalSpaces: number;
    totalTasks: number;
    totalGraphs: number;
    totalExecutions: number;
    totalVerifications: number;
    totalRecoveryPlans: number;
    totalGovernanceDecisions: number;
    totalLoopSessions: number;
    totalAgents: number;
    totalEvidence: number;
    totalProviders: number;
  };
  health: {
    degradedCount: number;
    blockedCount: number;
    failedCount: number;
    reviewCount: number;
  };
  generatedAt: string;
}
