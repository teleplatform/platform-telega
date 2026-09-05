export interface DashboardMetric {
  label: string;
  value: number | string;
  unit?: string;
  trend?: "up" | "down" | "stable";
  severity?: "ok" | "warning" | "critical";
}

export interface DashboardPanel {
  id: string;
  title: string;
  icon: string;
  type: "grid" | "list" | "chart" | "status" | "actions";
  metrics: DashboardMetric[];
}

export interface DashboardSummary {
  totalMissions: number;
  activeMissions: number;
  totalGoals: number;
  completedGoals: number;
  totalGraphs: number;
  runningGraphs: number;
  totalCapsules: number;
  totalAgents: number;
  activeAgents: number;
  totalSessions: number;
  activeSessions: number;
  totalOutcomes: number;
  successRate: number;
  policyDenials: number;
  humanOverrides: number;
  emergencyStops: number;
}

export interface DashboardWidget {
  id: string;
  panelId: string;
  title: string;
  type: string;
  data: unknown;
}

export interface MissionControlDashboard {
  summary: DashboardSummary;
  panels: DashboardPanel[];
  widgets: DashboardWidget[];
  surfaces: Array<{ name: string; type: string; status: string }>;
  generatedAt: string;
}
