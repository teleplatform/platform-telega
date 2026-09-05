import { Mission } from "../mission/missionTypes.js";

export interface MissionWorkspaceCard {
  label: string;
  value: number | string;
  icon: string;
  severity?: "ok" | "warning" | "critical";
}

export interface MissionWorkspaceSection {
  id: string;
  title: string;
  type: "list" | "summary";
  items: unknown[];
}

export interface MissionWorkspace {
  mission: Mission | null;
  missionId: string;
  cards: MissionWorkspaceCard[];
  sections: MissionWorkspaceSection[];
  health: "healthy" | "degraded" | "critical";
  generatedAt: string;
}
