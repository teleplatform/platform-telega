import { TimelineEvent, TimelineEventKind, MissionTimeline, TimelineSummary } from "./timelineTypes";
import { MissionRegistry } from "../mission/missionRegistry.js";
import { SpaceRegistry } from "../spaces/spaceRegistry.js";
import { SessionRegistry } from "../surface/sessionSurface.js";
import { GovernanceRegistry } from "../governance/outcomeRegistry.js";
import { LiveRegistry } from "../live/liveRegistry.js";

function collectMissionEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const missions = MissionRegistry.getAll();

  for (const m of missions) {
    events.push({
      id: `tl_mission_${m.id}_created`,
      kind: "mission_created",
      title: `Mission created: ${m.title}`,
      description: m.description || "",
      timestamp: m.createdAt,
      source: "MissionRegistry",
      sourceId: m.id,
      missionId: m.id,
      spaceId: null,
      evidenceRef: null,
    });

    if (m.startedAt) {
      events.push({
        id: `tl_mission_${m.id}_activated`,
        kind: "mission_activated",
        title: `Mission activated: ${m.title}`,
        description: "",
        timestamp: m.startedAt,
        source: "MissionRegistry",
        sourceId: m.id,
        missionId: m.id,
        spaceId: null,
        evidenceRef: null,
      });
    }

    if (m.completedAt) {
      const kind: TimelineEventKind = m.status === "failed" ? "mission_failed" : "mission_completed";
      events.push({
        id: `tl_mission_${m.id}_${kind}`,
        kind,
        title: `Mission ${m.status}: ${m.title}`,
        description: "",
        timestamp: m.completedAt,
        source: "MissionRegistry",
        sourceId: m.id,
        missionId: m.id,
        spaceId: null,
        evidenceRef: null,
      });
    }
  }

  return events;
}

function collectSpaceEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const spaces = SpaceRegistry.getAll();

  for (const s of spaces) {
    events.push({
      id: `tl_space_${s.id}_created`,
      kind: "space_created",
      title: `Space created: ${s.name}`,
      description: s.description,
      timestamp: s.createdAt,
      source: "SpaceRegistry",
      sourceId: s.id,
      missionId: s.missionId,
      spaceId: s.id,
      evidenceRef: null,
    });

    if (s.status === "archived") {
      events.push({
        id: `tl_space_${s.id}_archived`,
        kind: "space_archived",
        title: `Space archived: ${s.name}`,
        description: "",
        timestamp: s.updatedAt,
        source: "SpaceRegistry",
        sourceId: s.id,
        missionId: s.missionId,
        spaceId: s.id,
        evidenceRef: null,
      });
    }
  }

  return events;
}

function collectEvidenceEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const outcomes = GovernanceRegistry.getAll();

  for (const o of outcomes) {
    const kind: TimelineEventKind = o.trusted ? "evidence_verified" : "evidence_created";
    events.push({
      id: `tl_ev_${o.outcomeId}`,
      kind,
      title: `Evidence: ${o.kind}`,
      description: o.summary,
      timestamp: o.timestamp,
      source: "GovernanceRegistry",
      sourceId: o.outcomeId,
      missionId: null,
      spaceId: null,
      evidenceRef: o.outcomeId,
    });
  }

  return events;
}

function collectLiveEvents(): TimelineEvent[] {
  return LiveRegistry.getFeed(100).map((e) => ({
    id: `tl_live_${e.id}`,
    kind: "task_running" as TimelineEventKind,
    title: e.summary,
    description: "",
    timestamp: new Date(e.timestamp).getTime(),
    source: e.source,
    sourceId: e.id,
    missionId: null,
    spaceId: null,
    evidenceRef: null,
  }));
}

export function buildTimeline(missionId?: string): MissionTimeline {
  let allEvents: TimelineEvent[] = [
    ...collectMissionEvents(),
    ...collectSpaceEvents(),
    ...collectEvidenceEvents(),
    ...collectLiveEvents(),
  ];

  // Filter by mission
  if (missionId) {
    allEvents = allEvents.filter((e) => e.missionId === missionId);
  }

  // Sort by timestamp
  allEvents.sort((a, b) => a.timestamp - b.timestamp);

  const firstEvent = allEvents.length > 0 ? allEvents[0].timestamp : 0;
  const lastEvent = allEvents.length > 0 ? allEvents[allEvents.length - 1].timestamp : 0;

  // Find mission title
  let title = "All Missions";
  if (missionId) {
    const mission = MissionRegistry.get(missionId);
    if (mission) title = mission.title;
  }

  return {
    missionId: missionId || null,
    title,
    events: allEvents,
    eventCount: allEvents.length,
    span: {
      firstEvent,
      lastEvent,
      durationMs: lastEvent - firstEvent,
    },
  };
}

export function buildTimelineSummary(): TimelineSummary {
  const allEvents = buildTimeline();
  const byKind: Record<string, number> = {};

  for (const e of allEvents.events) {
    byKind[e.kind] = (byKind[e.kind] || 0) + 1;
  }

  const missions = MissionRegistry.getAll();
  const spaces = SpaceRegistry.getAll();

  return {
    totalEvents: allEvents.eventCount,
    byKind,
    missions: missions.length,
    spaces: spaces.length,
    oldest: allEvents.span.firstEvent > 0 ? allEvents.span.firstEvent : null,
    newest: allEvents.span.lastEvent > 0 ? allEvents.span.lastEvent : null,
  };
}
