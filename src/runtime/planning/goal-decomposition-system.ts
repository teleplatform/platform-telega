import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { generateAllPacks, type PackProposal } from "../knowledge/knowledge-to-pack-generator.js";

export interface DecomposedGoal {
  goal_id: string;
  title: string;
  phases: DecomposedPhase[];
  created_at: string;
}

export interface DecomposedPhase {
  phase_id: string;
  name: string;
  packs: string[];
  tasks: string[];
}

let goalCounter = 0;

export function decomposeGoal(title: string, description: string): DecomposedGoal {
  goalCounter++;
  const packs = generateAllPacks();

  const phases: DecomposedPhase[] = [
    {
      phase_id: `phase_${Date.now()}_${goalCounter}_1`,
      name: "Knowledge Preparation",
      packs: packs.filter((p) => p.source === "canon").map((p) => p.pack_id),
      tasks: ["Register canons", "Validate promotion gates", "Check conflicts"],
    },
    {
      phase_id: `phase_${Date.now()}_${goalCounter}_2`,
      name: "Doctrine Integration",
      packs: packs.filter((p) => p.source === "doctrine").map((p) => p.pack_id),
      tasks: ["Compile doctrines to policies", "Enforce doctrine checks", "Detect drift"],
    },
    {
      phase_id: `phase_${Date.now()}_${goalCounter}_3`,
      name: "Cultural Memory Capture",
      packs: packs.filter((p) => p.source === "cultural_memory").map((p) => p.pack_id),
      tasks: ["Record lessons", "Generate narratives", "Update governance dashboard"],
    },
  ];

  const goal: DecomposedGoal = {
    goal_id: `goal_${Date.now()}_${goalCounter}`,
    title,
    phases,
    created_at: new Date().toISOString(),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(goal.goal_id, "goal_decomposition_created"),
    trace_id: goal.goal_id,
    job_id: "planning",
    type: "goal_decomposition_created",
    timestamp: goal.created_at,
    payload: {
      goal_id: goal.goal_id,
      title,
      phases: phases.length,
      total_packs: packs.length,
    },
  });

  return goal;
}
