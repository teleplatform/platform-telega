import { EvidenceItem, EvidenceDetail, EvidenceExplorerSummary, EvidenceStatus } from "./evidenceExplorerTypes";
import { GovernanceRegistry } from "../governance/outcomeRegistry.js";
import { SpaceRegistry } from "../spaces/spaceRegistry.js";
import { MissionRegistry } from "../mission/missionRegistry.js";

function buildEvidenceItems(): EvidenceItem[] {
  const outcomes = GovernanceRegistry.getAll();

  return outcomes.map((o) => {
    const status: EvidenceStatus = o.trusted ? "verified" : "untrusted";

    // Find spaces that reference this evidence
    const spaces = SpaceRegistry.getAll().filter((s) => s.evidenceRefs.includes(o.outcomeId));

    return {
      evidenceId: o.outcomeId,
      kind: o.kind,
      source: o.source,
      severity: o.severity,
      summary: o.summary,
      status,
      trusted: o.trusted,
      missionId: (o.details as any)?.missionId || null,
      spaceIds: spaces.map((s) => s.id),
      taskId: (o.details as any)?.jobId || (o.details as any)?.taskId || null,
      artifactRefs: [],
      timestamp: o.timestamp,
    };
  });
}

export function exploreEvidence(missionId?: string, spaceId?: string, status?: string): EvidenceItem[] {
  let items = buildEvidenceItems();

  if (missionId) items = items.filter((i) => i.missionId === missionId);
  if (spaceId) items = items.filter((i) => i.spaceIds.includes(spaceId));
  if (status === "verified") items = items.filter((i) => i.trusted);
  if (status === "untrusted") items = items.filter((i) => !i.trusted);

  return items.sort((a, b) => b.timestamp - a.timestamp);
}

export function getEvidenceDetail(evidenceId: string): EvidenceDetail | null {
  const items = buildEvidenceItems();
  const item = items.find((i) => i.evidenceId === evidenceId);
  if (!item) return null;

  const relatedMissions = item.missionId
    ? MissionRegistry.getAll()
        .filter((m) => m.id === item.missionId)
        .map((m) => ({ id: m.id, title: m.title }))
    : [];

  const relatedSpaces = item.spaceIds
    .map((sid) => {
      const space = SpaceRegistry.get(sid);
      return space ? { id: space.id, name: space.name } : null;
    })
    .filter((s): s is { id: string; name: string } => !!s);

  return {
    item,
    relatedMissions,
    relatedSpaces,
    timelineRefs: [`tl_ev_${evidenceId}`],
  };
}

export function exploreSummary(): EvidenceExplorerSummary {
  const items = buildEvidenceItems();

  const byKind: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};

  for (const i of items) {
    byKind[i.kind] = (byKind[i.kind] || 0) + 1;
    bySource[i.source] = (bySource[i.source] || 0) + 1;
    bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
  }

  return {
    total: items.length,
    verified: items.filter((i) => i.trusted).length,
    untrusted: items.filter((i) => !i.trusted).length,
    byKind,
    bySource,
    bySeverity,
  };
}
