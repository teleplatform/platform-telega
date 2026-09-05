export interface ProviderStats {
  providerId: string;
  taskType: string;
  successCount: number;
  failureCount: number;
  totalDurationMs: number;
  totalCostUsd: number;
  repairCount: number;
  rollbackCount: number;
  lastUsedAt: number;
}

export interface RoutingProfile {
  profileId: string;
  taskType: string;
  preferredProviders: Array<{
    providerId: string;
    score: number;
    reason: string;
  }>;
  successRate: number;
  averageLatencyMs: number;
  sampleSize: number;
  updatedAt: number;
}

export interface RoutingDecision {
  taskType: string;
  selectedProvider: string;
  score: number;
  reasons: string[];
  alternatives: Array<{ providerId: string; score: number }>;
}

export interface RoutingProposal {
  proposalId: string;
  taskType: string;
  currentProvider: string;
  recommendedProvider: string;
  confidence: number;
  reason: string;
  evidenceRefs: string[];
  status: "draft" | "review" | "approved" | "rejected";
  createdAt: number;
}
