export type OverrideAction =
  | "pause" | "resume" | "approve" | "reject"
  | "cancel" | "retry" | "escalate" | "emergency_stop";

export type OverrideTargetType =
  | "mission" | "goal" | "graph" | "agent" | "repair" | "system";

export type OverrideStatus =
  | "pending" | "approved" | "rejected" | "executed" | "failed";

export interface OverrideRequest {
  overrideId: string;
  targetType: OverrideTargetType;
  targetId: string;
  action: OverrideAction;
  reason: string;
  requestedBy: string;
  status: OverrideStatus;
  result: string | null;
  createdAt: number;
  executedAt: number | null;
}

export interface OverrideResult {
  overrideId: string;
  action: OverrideAction;
  success: boolean;
  affectedObjects: string[];
  evidenceRefs: string[];
  timestamp: number;
  error?: string;
}
