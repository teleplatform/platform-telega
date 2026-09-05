export type CreatorPanel =
  | "mission_control" | "forge_dispatch" | "evidence_inspector"
  | "provider_debug" | "override_controls" | "resource_monitor" | "capsule_viewer";

export type CreatorPermission =
  | "forge.dispatch" | "evidence.inspect" | "provider.switch"
  | "override.execute" | "capsule.open" | "policy.edit" | "system.reload";

export interface CreatorAction {
  actionId: string;
  panel: CreatorPanel;
  name: string;
  description: string;
  permission: CreatorPermission;
}

export interface CreatorModeState {
  mode: "creator";
  role: "kreator";
  panels: CreatorPanel[];
  permissions: CreatorPermission[];
  sessionId: string | null;
  missionId: string | null;
}
