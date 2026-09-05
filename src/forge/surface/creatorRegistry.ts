import { CreatorPanel, CreatorAction, CreatorPermission, CreatorModeState } from "./creatorTypes";

const PANEL_DESCRIPTIONS: Record<CreatorPanel, string> = {
  mission_control: "Oversee missions, approve/reject proposals",
  forge_dispatch: "Send tasks directly to Sigma Forge execution",
  evidence_inspector: "Browse evidence, traces, and outcomes",
  provider_debug: "View and switch providers, inspect health",
  override_controls: "Pause, resume, emergency stop system runtimes",
  resource_monitor: "Monitor CPU, RAM, swap, disk in real time",
  capsule_viewer: "Inspect and replay execution capsules",
};

const DEFAULT_PANELS: CreatorPanel[] = [
  "mission_control", "forge_dispatch", "evidence_inspector",
  "provider_debug", "override_controls",
];

const DEFAULT_PERMISSIONS: CreatorPermission[] = [
  "forge.dispatch", "evidence.inspect", "provider.switch",
  "override.execute", "capsule.open",
];

const actions: CreatorAction[] = [];

let counter = 0;
function genId(): string {
  counter++;
  return `ca_${Date.now()}_${counter}`;
}

export const CreatorRegistry = {
  registerAction(panel: CreatorPanel, name: string, description: string, permission: CreatorPermission): CreatorAction {
    const action: CreatorAction = { actionId: genId(), panel, name, description, permission };
    actions.push(action);
    return action;
  },

  getActions(panel?: CreatorPanel): CreatorAction[] {
    if (panel) return actions.filter((a) => a.panel === panel);
    return [...actions];
  },

  getPanels(): CreatorPanel[] {
    return [...DEFAULT_PANELS];
  },

  getPanelDescription(panel: CreatorPanel): string {
    return PANEL_DESCRIPTIONS[panel] || "";
  },

  getState(sessionId?: string, missionId?: string): CreatorModeState {
    return {
      mode: "creator",
      role: "kreator",
      panels: DEFAULT_PANELS,
      permissions: DEFAULT_PERMISSIONS,
      sessionId: sessionId || null,
      missionId: missionId || null,
    };
  },

  hasPermission(permission: CreatorPermission): boolean {
    return DEFAULT_PERMISSIONS.includes(permission);
  },
};
