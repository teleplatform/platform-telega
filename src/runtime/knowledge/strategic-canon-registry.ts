import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type CanonCategory =
  | "architecture"
  | "governance"
  | "safety"
  | "federation"
  | "recovery"
  | "epistemic"
  | "economy"
  | "diplomacy";

export type CanonStatus = "draft" | "proposed" | "active" | "superseded" | "archived";

export interface CanonEntry {
  canon_id: string;
  category: CanonCategory;
  title: string;
  description: string;
  evidence_refs: string[];
  version: number;
  status: CanonStatus;
  created_at: string;
  updated_at: string;
}

const CANONS: Map<string, CanonEntry> = new Map();
let canonCounter = 0;

export async function registerCanon(
  category: CanonCategory,
  title: string,
  description: string,
  evidenceRefs: string[] = [],
): Promise<CanonEntry> {
  canonCounter++;
  const entry: CanonEntry = {
    canon_id: `canon_${Date.now()}_${canonCounter}`,
    category,
    title,
    description,
    evidence_refs: evidenceRefs,
    version: 1,
    status: "draft",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  CANONS.set(entry.canon_id, entry);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(entry.canon_id, "strategic_canon_registered"),
    trace_id: entry.canon_id,
    job_id: "knowledge",
    type: "strategic_canon_registered",
    timestamp: entry.created_at,
    payload: {
      canon_id: entry.canon_id,
      category,
      version: entry.version,
    },
  });

  return entry;
}

export async function updateCanon(
  canonId: string,
  updates: Partial<Pick<CanonEntry, "description" | "evidence_refs">>,
): Promise<CanonEntry | null> {
  const entry = CANONS.get(canonId);
  if (!entry) return null;

  if (updates.description !== undefined) entry.description = updates.description;
  if (updates.evidence_refs) entry.evidence_refs = [...new Set([...entry.evidence_refs, ...updates.evidence_refs])];
  entry.updated_at = new Date().toISOString();

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${canonId}_upd`, "strategic_canon_updated"),
    trace_id: canonId,
    job_id: "knowledge",
    type: "strategic_canon_updated",
    timestamp: entry.updated_at,
    payload: { canon_id: canonId, version: entry.version },
  });

  return entry;
}

export function getCanon(canonId: string): CanonEntry | null {
  return CANONS.get(canonId) || null;
}

export function getActiveCanons(): CanonEntry[] {
  return Array.from(CANONS.values()).filter((c) => c.status === "active");
}

export function getCanonsByCategory(category: CanonCategory): CanonEntry[] {
  return Array.from(CANONS.values()).filter((c) => c.category === category);
}

export function getAllCanons(): CanonEntry[] {
  return Array.from(CANONS.values());
}
