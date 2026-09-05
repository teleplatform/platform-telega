export interface WorkspaceCard {
  id: string;
  title: string;
  icon: string;
  value: number | string;
  severity?: "ok" | "warning" | "critical";
  route: string;
}

export interface WorkspaceSection {
  id: string;
  title: string;
  type: "cards" | "list" | "feed" | "chart";
  items: unknown[];
}

export interface Workspace {
  overview: {
    systemStatus: "healthy" | "degraded" | "critical";
    uptime: number;
    lastAudit: string;
    totalChecks: number;
    healthyChecks: number;
  };
  cards: WorkspaceCard[];
  sections: WorkspaceSection[];
  generatedAt: string;
}
