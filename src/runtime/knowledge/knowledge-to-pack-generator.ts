import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons } from "./strategic-canon-registry.js";
import { getAllDoctrines } from "./runtime-doctrine-registry.js";
import { getAllCulturalMemory } from "./runtime-cultural-memory.js";
import { checkEvolutionProposalGovernance } from "../hooks/evolution-proposal-governance-hook.js";

export type PackSource = "canon" | "doctrine" | "cultural_memory";

export interface PackProposal {
  pack_id: string;
  source: PackSource;
  source_ids: string[];
  title: string;
  description: string;
  modules_affected: string[];
  evidence_types: string[];
  created_at: string;
  approved: boolean;
}

let packCounter = 0;

export function generatePackProposal(source: PackSource): PackProposal {
  packCounter++;

  let sourceIds: string[] = [];
  let description: string;
  let modulesAffected: string[] = [];
  let evidenceTypes: string[] = [];

  switch (source) {
    case "canon": {
      const canons = getActiveCanons();
      sourceIds = canons.map((c) => c.canon_id);
      description = `KCA pack from ${canons.length} active canons`;
      modulesAffected = [...new Set(canons.map((c) => `src/runtime/${c.category}/`))];
      evidenceTypes = ["strategic_canon_registered", "canon_promoted", "canon_promotion_blocked"];
      break;
    }
    case "doctrine": {
      const doctrines = getAllDoctrines();
      sourceIds = doctrines.map((d) => d.doctrine_id);
      description = `KCA pack from ${doctrines.length} doctrines`;
      modulesAffected = [".sigma/policies/", "src/runtime/knowledge/"];
      evidenceTypes = ["runtime_doctrine_registered", "doctrine_enforcement_checked", "doctrine_enforcement_blocked"];
      break;
    }
    case "cultural_memory": {
      const memory = getAllCulturalMemory();
      sourceIds = memory.map((m) => m.entry_id);
      description = `KCA pack from ${memory.length} cultural memory entries`;
      modulesAffected = ["src/runtime/knowledge/"];
      evidenceTypes = ["runtime_cultural_memory_written", "strategic_narrative_generated"];
      break;
    }
  }

  const pack: PackProposal = {
    pack_id: `pack_${Date.now()}_${packCounter}`,
    source,
    source_ids: sourceIds,
    title: `Knowledge Pack: ${source.replace(/_/g, " ")}`,
    description,
    modules_affected: modulesAffected,
    evidence_types: evidenceTypes,
    created_at: new Date().toISOString(),
    approved: false,
  };

  checkEvolutionProposalGovernance({
    kind: "pack_generation",
    proposal_id: pack.pack_id,
    requested_by: "system",
    risk_hint: "medium",
  }).then((gate) => {
    if (gate.decision !== "allowed") {
      pack.approved = false;
    }
  }).catch(() => {});

  appendEvidenceRecord({
    evidence_id: hashTraceId(pack.pack_id, "knowledge_pack_proposal_created"),
    trace_id: pack.pack_id,
    job_id: "knowledge",
    type: "knowledge_pack_proposal_created",
    timestamp: pack.created_at,
    payload: {
      pack_id: pack.pack_id,
      source,
      source_count: sourceIds.length,
      modules_affected: modulesAffected,
    },
  });

  return pack;
}

export function generateAllPacks(): PackProposal[] {
  return (["canon", "doctrine", "cultural_memory"] as PackSource[]).map(generatePackProposal);
}
