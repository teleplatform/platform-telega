import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";
import { getAllDoctrines } from "./runtime-doctrine-registry.js";

export type TreatyStatus = "proposed" | "active" | "suspended" | "terminated";

export interface CivilizationTreaty {
  treaty_id: string;
  name: string;
  parties: string[];
  doctrine_compatibility: string[];
  shared_governance_rules: string[];
  status: TreatyStatus;
  created_at: string;
  updated_at: string;
}

const TREATIES: Map<string, CivilizationTreaty> = new Map();
let treatyCounter = 0;

export async function createTreaty(
  name: string,
  parties: string[],
  sharedGovernanceRules: string[] = [],
): Promise<CivilizationTreaty> {
  treatyCounter++;

  const doctrines = getAllDoctrines();
  const doctrineCompatibility = doctrines.filter((d) => d.immutable).map((d) => d.title);

  const treaty: CivilizationTreaty = {
    treaty_id: `treaty_${Date.now()}_${treatyCounter}`,
    name,
    parties,
    doctrine_compatibility: doctrineCompatibility,
    shared_governance_rules: sharedGovernanceRules,
    status: "proposed",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  TREATIES.set(treaty.treaty_id, treaty);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(treaty.treaty_id, "civilization_treaty_created"),
    trace_id: treaty.treaty_id,
    job_id: "knowledge",
    type: "civilization_treaty_created",
    timestamp: treaty.created_at,
    payload: {
      treaty_id: treaty.treaty_id,
      name,
      parties,
      doctrine_compatibility: doctrineCompatibility.length,
    },
  });

  return treaty;
}

export async function verifyTreaty(treatyId: string): Promise<boolean> {
  const treaty = TREATIES.get(treatyId);
  if (!treaty) return false;

  const evidence = readEvidenceRecords();
  const hasVerifiable = evidence.some((e) =>
    e.type === "runtime_treaty_revoked" || e.type === "federation_survival_mode_started",
  );

  const verified = treaty.parties.length >= 2 && !hasVerifiable;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${treatyId}_verify`, "civilization_treaty_verified"),
    trace_id: treatyId,
    job_id: "knowledge",
    type: "civilization_treaty_verified",
    timestamp: new Date().toISOString(),
    payload: {
      treaty_id: treatyId,
      verified,
      parties: treaty.parties,
    },
  });

  if (verified) treaty.status = "active";
  treaty.updated_at = new Date().toISOString();

  return verified;
}

export function getTreaty(treatyId: string): CivilizationTreaty | null {
  return TREATIES.get(treatyId) || null;
}

export function getActiveTreaties(): CivilizationTreaty[] {
  return Array.from(TREATIES.values()).filter((t) => t.status === "active");
}
