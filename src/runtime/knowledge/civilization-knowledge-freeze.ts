import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllDoctrines } from "./runtime-doctrine-registry.js";
import { getActiveCanons, getAllCanons } from "./strategic-canon-registry.js";
import { getAllCulturalMemory } from "./runtime-cultural-memory.js";
import { getActiveTreaties } from "./runtime-civilization-treaty-system.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

const FREEZE_DIR = path.join(process.cwd(), ".data", "civilization-knowledge");
const FREEZE_PATH = path.join(FREEZE_DIR, "civilization-knowledge-freeze.json");

export interface CivilizationKnowledgeFreeze {
  frozen_at: string;
  doctrines: number;
  canons: { total: number; active: number };
  cultural_memory_entries: number;
  treaties: number;
  evidence_count: number;
  snapshot_path: string;
}

export async function freezeCivilizationKnowledge(): Promise<CivilizationKnowledgeFreeze> {
  if (!fs.existsSync(FREEZE_DIR)) {
    fs.mkdirSync(FREEZE_DIR, { recursive: true });
  }

  const doctrines = getAllDoctrines();
  const allCanons = getAllCanons();
  const activeCanons = getActiveCanons();
  const culturalMemory = getAllCulturalMemory();
  const treaties = getActiveTreaties();
  const evidence = readEvidenceRecords();

  const snapshot = {
    frozen_at: new Date().toISOString(),
    doctrines: doctrines.map((d) => ({ id: d.doctrine_id, title: d.title, category: d.category, priority: d.priority, immutable: d.immutable })),
    canons: {
      total: allCanons.map((c) => ({ id: c.canon_id, title: c.title, category: c.category, status: c.status, version: c.version })),
      active: activeCanons.map((c) => c.canon_id),
    },
    cultural_memory: culturalMemory.map((e) => ({ id: e.entry_id, category: e.category, title: e.title })),
    treaties: treaties.map((t) => ({ id: t.treaty_id, name: t.name, parties: t.parties })),
    evidence_count: evidence.length,
  };

  fs.writeFileSync(FREEZE_PATH, JSON.stringify(snapshot, null, 2), { encoding: "utf8" });

  const freeze: CivilizationKnowledgeFreeze = {
    frozen_at: snapshot.frozen_at,
    doctrines: doctrines.length,
    canons: { total: allCanons.length, active: activeCanons.length },
    cultural_memory_entries: culturalMemory.length,
    treaties: treaties.length,
    evidence_count: evidence.length,
    snapshot_path: FREEZE_PATH,
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId("civ_knowledge_freeze", "civilization_knowledge_freeze_created"),
    trace_id: "civ_knowledge_freeze",
    job_id: "knowledge",
    type: "civilization_knowledge_freeze_created",
    timestamp: freeze.frozen_at,
    payload: {
      doctrines: freeze.doctrines,
      canons_total: freeze.canons.total,
      canons_active: freeze.canons.active,
      cultural_memory: freeze.cultural_memory_entries,
      treaties: freeze.treaties,
      evidence: freeze.evidence_count,
    },
  });

  return freeze;
}
