export type BrowserAgentSurface = "browser";
export type BrowserAgentMode = "public" | "creator";
export type BrowserAgentEffect = "confirmed" | "failed";
export type BrowserAgentTarget = "active_tab" | "history" | "dom" | "browser_tab";
export type BrowserAgentAction = "click" | "navigate" | "close_tab" | "open_tab" | "dom_read" | "dom_modify" | "search" | "summary" | "highlight";

export interface BrowserAgentIntent {
  id: string;
  userId: string;
  mode: BrowserAgentMode;
  command: string;
  target?: BrowserAgentTarget;
  action?: BrowserAgentAction;
  requiresConsent: boolean;
}

export interface BrowserAgentEvidence {
  intent: string;
  target: string;
  action: string;
  effect: BrowserAgentEffect;
  evidence: string;
  timestamp: string;
  surface: BrowserAgentSurface;
}

export interface BrowserAgentPlan {
  status: "planned" | "executing" | "completed" | "failed";
  plan: string[];
  evidence?: BrowserAgentEvidence;
  error?: string;
}
