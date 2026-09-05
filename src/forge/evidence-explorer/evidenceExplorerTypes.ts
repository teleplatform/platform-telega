export type EvidenceStatus = "created" | "verified" | "untrusted";

export interface EvidenceItem {
  evidenceId: string;
  kind: string;
  source: string;
  severity: string;
  summary: string;
  status: EvidenceStatus;
  trusted: boolean;
  missionId: string | null;
  spaceIds: string[];
  taskId: string | null;
  artifactRefs: string[];
  timestamp: number;
}

export interface EvidenceDetail {
  item: EvidenceItem;
  relatedMissions: Array<{ id: string; title: string }>;
  relatedSpaces: Array<{ id: string; name: string }>;
  timelineRefs: string[];
}

export interface EvidenceExplorerSummary {
  total: number;
  verified: number;
  untrusted: number;
  byKind: Record<string, number>;
  bySource: Record<string, number>;
  bySeverity: Record<string, number>;
}
