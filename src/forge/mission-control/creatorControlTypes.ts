export interface PendingApproval {
  id: string;
  type: "policy_proposal" | "routing_proposal" | "improv_proposal" | "override_request";
  title: string;
  summary: string;
  source: string;
  createdAt: number;
}

export interface QuickAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  action: string;
  params: Record<string, unknown>;
  risk: "low" | "medium" | "high" | "critical";
}

export interface CreatorControlState {
  mode: "creator";
  pendingApprovals: PendingApproval[];
  quickActions: QuickAction[];
  systemStatus: {
    missions: number;
    graphs: number;
    agents: number;
    sessions: number;
    repairs: number;
    outcomes: number;
  };
}

export interface ActionResult {
  ok: boolean;
  action: string;
  message: string;
  timestamp: number;
}
