import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllCanons, getActiveCanons } from "./strategic-canon-registry.js";
import { getAllDoctrines } from "./runtime-doctrine-registry.js";
import { getAllCulturalMemory } from "./runtime-cultural-memory.js";
import { getPendingApprovals } from "./pack-proposal-approval-queue.js";
import { detectDoctrineDrift } from "./doctrine-drift-detector.js";
import { analyzeAllCanonImpacts } from "./canon-impact-analyzer.js";

const FREEZE_DIR = path.join(process.cwd(), ".data", "knowledge-governance");
const FREEZE_PATH = path.join(FREEZE_DIR, "knowledge-governance-baseline.json");

export interface GovernanceBaseline {
  frozen_at: string;
  canons: { total: number; active: number };
  doctrines: number;
  cultural_memory: number;
  pending_approvals: number;
  drifts: number;
  canon_impacts: number;
}

export async function freezeGovernanceBaseline(): Promise<GovernanceBaseline> {
  if (!fs.existsSync(FREEZE_DIR)) {
    fs.mkdirSync(FREEZE_DIR, { recursive: true });
  }

  const allCanons = getAllCanons();
  const activeCanons = getActiveCanons();
  const doctrines = getAllDoctrines();
  const culturalMemory = getAllCulturalMemory();
  const pendingApprovals = getPendingApprovals();
  const drifts = detectDoctrineDrift();
  const impacts = analyzeAllCanonImpacts();

  const baseline: GovernanceBaseline = {
    frozen_at: new Date().toISOString(),
    canons: { total: allCanons.length, active: activeCanons.length },
    doctrines: doctrines.length,
    cultural_memory: culturalMemory.length,
    pending_approvals: pendingApprovals.length,
    drifts: drifts.filter((d) => !d.resolved).length,
    canon_impacts: impacts.length,
  };

  fs.writeFileSync(FREEZE_PATH, JSON.stringify(baseline, null, 2), { encoding: "utf8" });

  await appendEvidenceRecord({
    evidence_id: hashTraceId("gov_baseline", "knowledge_governance_baseline_frozen"),
    trace_id: "gov_baseline",
    job_id: "knowledge",
    type: "knowledge_governance_baseline_frozen",
    timestamp: baseline.frozen_at,
    payload: {
      canons_total: baseline.canons.total,
      canons_active: baseline.canons.active,
      doctrines: baseline.doctrines,
      cultural_memory: baseline.cultural_memory,
      pending_approvals: baseline.pending_approvals,
      drifts: baseline.drifts,
    },
  });

  return baseline;
}

export async function compareGovernanceBaseline(): Promise<{
  previous: GovernanceBaseline | null;
  current: GovernanceBaseline;
  differences: string[];
}> {
  let previous: GovernanceBaseline | null = null;
  if (fs.existsSync(FREEZE_PATH)) {
    try {
      previous = JSON.parse(fs.readFileSync(FREEZE_PATH, { encoding: "utf8" }));
    } catch {}
  }

  const current = await freezeGovernanceBaseline();
  const differences: string[] = [];

  if (previous) {
    if (previous.canons.active !== current.canons.active) {
      differences.push(`active canons: ${previous.canons.active} → ${current.canons.active}`);
    }
    if (previous.doctrines !== current.doctrines) {
      differences.push(`doctrines: ${previous.doctrines} → ${current.doctrines}`);
    }
    if (previous.cultural_memory !== current.cultural_memory) {
      differences.push(`cultural memory: ${previous.cultural_memory} → ${current.cultural_memory}`);
    }
    if (previous.pending_approvals !== current.pending_approvals) {
      differences.push(`pending approvals: ${previous.pending_approvals} → ${current.pending_approvals}`);
    }
    if (previous.drifts !== current.drifts) {
      differences.push(`drifts: ${previous.drifts} → ${current.drifts}`);
    }
    if (previous.canon_impacts !== current.canon_impacts) {
      differences.push(`canon impacts: ${previous.canon_impacts} → ${current.canon_impacts}`);
    }
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId("gov_baseline_compare", "knowledge_governance_baseline_compared"),
    trace_id: "gov_baseline",
    job_id: "knowledge",
    type: "knowledge_governance_baseline_compared",
    timestamp: current.frozen_at,
    payload: {
      has_previous: !!previous,
      differences_count: differences.length,
      differences,
    },
  });

  return { previous, current, differences };
}
