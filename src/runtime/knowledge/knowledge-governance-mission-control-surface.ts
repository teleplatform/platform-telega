import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons, getAllCanons } from "./strategic-canon-registry.js";
import { getAllDoctrines } from "./runtime-doctrine-registry.js";
import { getPendingApprovals } from "./pack-proposal-approval-queue.js";
import { detectDoctrineDrift } from "./doctrine-drift-detector.js";
import { analyzeAllCanonImpacts } from "./canon-impact-analyzer.js";
import { getAllCulturalMemory } from "./runtime-cultural-memory.js";

export interface GovernanceSurface {
  surface_id: string;
  viewed_at: string;
  active_canons: number;
  doctrines: number;
  pending_approvals: number;
  conflicts: number;
  drifts: number;
  impacts: number;
  cultural_memory: number;
  rendered: string;
}

let surfaceCounter = 0;

export function viewGovernanceSurface(): GovernanceSurface {
  surfaceCounter++;

  const activeCanons = getActiveCanons();
  const allCanons = getAllCanons();
  const doctrines = getAllDoctrines();
  const pendingApprovals = getPendingApprovals();
  const drifts = detectDoctrineDrift();
  const impacts = analyzeAllCanonImpacts();
  const culturalMemory = getAllCulturalMemory();

  const lines: string[] = [
    "╔══════════════════════════════════════════════╗",
    "║     KNOWLEDGE GOVERNANCE MISSION CONTROL     ║",
    "╚══════════════════════════════════════════════╝",
    "",
    "--- Canons ---",
    `  Total: ${allCanons.length}  Active: ${activeCanons.length}`,
    "",
    "--- Doctrines ---",
    `  Total: ${doctrines.length}`,
    "",
    "--- Pack Approvals ---",
    `  Pending: ${pendingApprovals.length}`,
    "",
    "--- Drifts ---",
    `  Active: ${drifts.filter((d) => !d.resolved).length}`,
    ...drifts.filter((d) => !d.resolved).map((d) => `  ⚠ [${d.severity}] ${d.description}`),
    "",
    "--- Impact Analysis ---",
    `  Reports: ${impacts.length}`,
    ...impacts.slice(0, 3).map((r) => `  • ${r.canon_title}: ${r.impacted_modules.length} modules`),
    "",
    "--- Cultural Memory ---",
    `  Entries: ${culturalMemory.length}`,
  ];

  const surface: GovernanceSurface = {
    surface_id: `gov_surface_${Date.now()}_${surfaceCounter}`,
    viewed_at: new Date().toISOString(),
    active_canons: activeCanons.length,
    doctrines: doctrines.length,
    pending_approvals: pendingApprovals.length,
    conflicts: 0,
    drifts: drifts.filter((d) => !d.resolved).length,
    impacts: impacts.length,
    cultural_memory: culturalMemory.length,
    rendered: lines.join("\n"),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(surface.surface_id, "knowledge_governance_surface_viewed"),
    trace_id: surface.surface_id,
    job_id: "knowledge",
    type: "knowledge_governance_surface_viewed",
    timestamp: surface.viewed_at,
    payload: {
      surface_id: surface.surface_id,
      active_canons: surface.active_canons,
      doctrines: surface.doctrines,
      pending_approvals: surface.pending_approvals,
      drifts: surface.drifts,
    },
  });

  return surface;
}
