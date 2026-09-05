export type CapsuleStatus = "building" | "completed" | "failed" | "verified";

export interface CapsuleArtifact {
  path: string;
  sha256: string;
  size: number;
  type: string;
  description: string;
}

export interface CapsuleVerification {
  ok: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    error?: string;
  }>;
  verifiedAt: number;
}

export interface CapsuleReplayPlan {
  capsuleId: string;
  steps: Array<{
    order: number;
    agentRole: string;
    taskTitle: string;
    jobNodeId: string;
    durationMs: number;
  }>;
  totalSteps: number;
  estimatedReplayDurationMs: number;
}

export interface CapsuleManifest {
  capsuleId: string;
  version: string;
  mission: string;
  graphId: string;
  status: CapsuleStatus;
  createdAt: number;
  completedAt: number | null;
  agents: string[];
  artifactCount: number;
  evidenceCount: number;
  verification: CapsuleVerification | null;
}

export interface CapsuleData {
  manifest: CapsuleManifest;
  graph: unknown;
  assignments: unknown[];
  results: unknown[];
  evidence: Array<{ kind: string; data: unknown }>;
  artifacts: CapsuleArtifact[];
  replayPlan: CapsuleReplayPlan | null;
}
