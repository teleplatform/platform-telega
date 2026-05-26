export type RiskLevel = "safe" | "low" | "medium" | "high" | "critical";

export const RISK_WEIGHT: Record<RiskLevel, number> = {
  safe: 0,
  low: 1,
  medium: 3,
  high: 6,
  critical: 10,
};

export type GovernanceVerdict = "allow" | "block" | "require_approval";

export interface GovernanceDecision {
  verdict: GovernanceVerdict;
  risk: RiskLevel;
  reason: string;
  policyMatch?: string;
  requiresApproval?: boolean;
  blocked: boolean;
}

export interface SandboxPolicy {
  allowedShellPrefixes: string[];
  blockedShellPatterns: RegExp[];
  allowedFileWritePrefixes: string[];
  blockedFileWritePatterns: RegExp[];
  allowedHttpDomains: string[];
  blockedHttpDomains: RegExp[];
  allowedBrowserDomains: string[];
  blockedBrowserDomains: RegExp[];
  maxFileWriteKb: number;
  maxShellTimeoutMs: number;
  maxActionsPerTask: number;
  maxConcurrentTasks: number;
}

export interface ApprovalRequest {
  id: string;
  taskId: string;
  actionId: string;
  actionLabel: string;
  actionType: string;
  risk: RiskLevel;
  reason: string;
  params: Record<string, unknown>;
  requestedAt: number;
  status: "pending" | "approved" | "rejected";
  decidedAt?: number;
  decidedBy?: string;
}

export interface BudgetState {
  taskId: string;
  actionsExecuted: number;
  actionsBlocked: number;
  totalCost: number;
  startedAt: number;
}
