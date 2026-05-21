import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllDoctrines } from "./runtime-doctrine-registry.js";
import { getActiveCanons, getAllCanons } from "./strategic-canon-registry.js";
import { getAllCulturalMemory } from "./runtime-cultural-memory.js";
import { getConstitutionState } from "../constitution/runtime-constitution.js";
import { detectCanonConflicts } from "./canon-conflict-detector.js";

export interface GovernanceDashboard {
  dashboard_id: string;
  viewed_at: string;
  canons: { total: number; active: number; draft: number; superseded: number; archived: number };
  doctrines: number;
  conflicts: number;
  approvals_pending: number;
  survival_state: string;
  epoch: string;
  rendered: string;
}

let dashboardCounter = 0;

export function viewGovernanceDashboard(): GovernanceDashboard {
  dashboardCounter++;
  const constitution = getConstitutionState();
  const doctrines = getAllDoctrines();
  const allCanons = getAllCanons();
  const activeCanons = getActiveCanons();
  const culturalMemory = getAllCulturalMemory();

  let conflicts = 0;
  for (const c of activeCanons) {
    conflicts += detectCanonConflicts(c).length;
  }

  const draftCanons = allCanons.filter((c) => c.status === "draft" || c.status === "proposed").length;
  const supersededCanons = allCanons.filter((c) => c.status === "superseded").length;
  const archivedCanons = allCanons.filter((c) => c.status === "archived").length;

  const lines: string[] = [
    "╔══════════════════════════════════════════════╗",
    "║     CIVILIZATION GOVERNANCE DASHBOARD        ║",
    "╚══════════════════════════════════════════════╝",
    `Epoch: ${constitution.epoch}`,
    `Freeze: ${constitution.emergency_freeze_active ? "ACTIVE" : "Inactive"}`,
    `Sovereignty: ${constitution.sovereignty_frozen ? "Frozen" : "Active"}`,
    "",
    "--- Canons ---",
    `  Total: ${allCanons.length}`,
    `  Active: ${activeCanons.length}`,
    `  Draft/Proposed: ${draftCanons}`,
    `  Superseded: ${supersededCanons}`,
    `  Archived: ${archivedCanons}`,
    `  Conflicts: ${conflicts}`,
    "",
    "--- Doctrines ---",
    `  Total: ${doctrines.length}`,
    "",
    "--- Cultural Memory ---",
    `  Entries: ${culturalMemory.length}`,
    `  Violations: ${constitution.violations.length}`,
  ];

  const dashboard: GovernanceDashboard = {
    dashboard_id: `gov_dash_${Date.now()}_${dashboardCounter}`,
    viewed_at: new Date().toISOString(),
    canons: {
      total: allCanons.length,
      active: activeCanons.length,
      draft: draftCanons,
      superseded: supersededCanons,
      archived: archivedCanons,
    },
    doctrines: doctrines.length,
    conflicts,
    approvals_pending: 0,
    survival_state: constitution.emergency_freeze_active ? "emergency_freeze" : "stable",
    epoch: constitution.epoch,
    rendered: lines.join("\n"),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(dashboard.dashboard_id, "civilization_governance_dashboard_viewed"),
    trace_id: dashboard.dashboard_id,
    job_id: "knowledge",
    type: "civilization_governance_dashboard_viewed",
    timestamp: dashboard.viewed_at,
    payload: {
      dashboard_id: dashboard.dashboard_id,
      canons: dashboard.canons,
      doctrines: dashboard.doctrines,
      conflicts,
    },
  });

  return dashboard;
}
