export interface SpaceWorkspaceCard {
  label: string;
  value: number | string;
  icon: string;
  severity?: "ok" | "warning" | "critical";
}

export interface SpaceWorkspaceSection {
  id: string;
  title: string;
  type: "list" | "summary";
  items: unknown[];
}

export interface SpaceWorkspace {
  spaceId: string;
  spaceName: string;
  cards: SpaceWorkspaceCard[];
  sections: SpaceWorkspaceSection[];
  health: "healthy" | "degraded" | "critical";
  generatedAt: string;
}
