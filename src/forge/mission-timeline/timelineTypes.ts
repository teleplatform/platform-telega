export type TimelineEventKind =
  | "mission_created" | "mission_activated" | "mission_completed" | "mission_failed"
  | "space_created" | "space_updated" | "space_archived"
  | "agent_assigned" | "agent_completed" | "agent_failed"
  | "task_created" | "task_running" | "task_completed" | "task_failed"
  | "evidence_created" | "evidence_verified"
  | "capsule_built" | "capsule_verified";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  title: string;
  description: string;
  timestamp: number;
  source: string;
  sourceId: string;
  missionId: string | null;
  spaceId: string | null;
  evidenceRef: string | null;
}

export interface MissionTimeline {
  missionId: string | null;
  title: string;
  events: TimelineEvent[];
  eventCount: number;
  span: {
    firstEvent: number;
    lastEvent: number;
    durationMs: number;
  };
}

export interface TimelineSummary {
  totalEvents: number;
  byKind: Record<string, number>;
  missions: number;
  spaces: number;
  oldest: number | null;
  newest: number | null;
}
