import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActiveCanons, getAllCanons, type CanonCategory } from "../knowledge/strategic-canon-registry.js";

export interface RoadmapNode {
  id: string;
  label: string;
  category: CanonCategory | "plan" | "phase";
  status: string;
  depends_on: string[];
  children: string[];
}

export interface CivilizationRoadmap {
  roadmap_id: string;
  generated_at: string;
  nodes: RoadmapNode[];
  progression: string[];
  rendered: string;
}

let roadmapCounter = 0;

export function generateCivilizationRoadmap(): CivilizationRoadmap {
  roadmapCounter++;

  const canons = getAllCanons();
  const activeCanons = getActiveCanons();

  const nodes: RoadmapNode[] = [];
  const categories: CanonCategory[] = [
    "architecture", "governance", "safety", "federation",
    "recovery", "epistemic", "economy", "diplomacy",
  ];

  for (const cat of categories) {
    const catCanons = canons.filter((c) => c.category === cat);
    if (catCanons.length === 0) continue;

    nodes.push({
      id: `cat_${cat}`,
      label: cat.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      category: cat,
      status: `${catCanons.filter((c) => c.status === "active").length}/${catCanons.length} active`,
      depends_on: [],
      children: catCanons.map((c) => c.canon_id),
    });

    for (const c of catCanons) {
      nodes.push({
        id: c.canon_id,
        label: c.title,
        category: cat,
        status: c.status,
        depends_on: [c.evidence_refs.length > 0 ? "evidence" : "no_evidence"],
        children: [],
      });
    }
  }

  const progression: string[] = [];
  for (const cat of categories) {
    const active = activeCanons.filter((c) => c.category === cat);
    if (active.length > 0) {
      progression.push(`${cat.replace(/_/g, " ")}: ${active.map((c) => c.title).join(", ")}`);
    }
  }

  const lines: string[] = [
    "╔══════════════════════════════════════════════╗",
    "║     CIVILIZATION ROADMAP                      ║",
    "╚══════════════════════════════════════════════╝",
    `Total Canons: ${canons.length}  Active: ${activeCanons.length}`,
    "",
    "--- Progression ---",
    ...progression.map((p) => `  → ${p}`),
    "",
    "--- Dependency Graph ---",
    ...nodes
      .filter((n) => n.children.length > 0)
      .map((n) => `  ${n.label} (${n.status}) → ${n.children.length} items`),
  ];

  const roadmap: CivilizationRoadmap = {
    roadmap_id: `roadmap_${Date.now()}_${roadmapCounter}`,
    generated_at: new Date().toISOString(),
    nodes,
    progression,
    rendered: lines.join("\n"),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(roadmap.roadmap_id, "civilization_roadmap_generated"),
    trace_id: roadmap.roadmap_id,
    job_id: "planning",
    type: "civilization_roadmap_generated",
    timestamp: roadmap.generated_at,
    payload: {
      roadmap_id: roadmap.roadmap_id,
      total_nodes: nodes.length,
      canon_categories: categories.filter((c) => canons.some((cn) => cn.category === c)).length,
      progression_length: progression.length,
    },
  });

  return roadmap;
}
