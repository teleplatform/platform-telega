export type PolicyEffect = "allow" | "deny" | "require_approval";
export type PolicyScope = "system" | "mission" | "agent" | "provider" | "resource";
export type PolicySeverity = "critical" | "high" | "medium" | "low";

export interface PolicyCondition {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "not_in" | "contains" | "matches";
  value: unknown;
}

export interface PolicyRule {
  ruleId: string;
  name: string;
  description: string;
  effect: PolicyEffect;
  priority: number;
  conditions: PolicyCondition[];
  reason: string;
}

export interface Policy {
  policyId: string;
  name: string;
  description: string;
  scope: PolicyScope;
  severity: PolicySeverity;
  rules: PolicyRule[];
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PolicyEvaluation {
  policyId: string;
  policyName: string;
  effect: PolicyEffect;
  matchedRule: string | null;
  reason: string;
  timestamp: number;
}

export interface PolicyContext {
  action: string;
  resource: string;
  agentRole?: string;
  providerId?: string;
  modelId?: string;
  estimatedCostUsd?: number;
  estimatedRuntimeMs?: number;
  requiresInternet?: boolean;
  requiresLocalModel?: boolean;
  memoryScopes?: string[];
  tools?: string[];
}

export interface PolicyResult {
  allowed: boolean;
  requiresApproval: boolean;
  evaluations: PolicyEvaluation[];
  summary: string;
}
