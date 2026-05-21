import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllDoctrines } from "./runtime-doctrine-registry.js";
import { getAllCulturalMemory } from "./runtime-cultural-memory.js";
import { getActiveCanons } from "./strategic-canon-registry.js";
import { getConstitutionState } from "../constitution/runtime-constitution.js";

export interface StrategicNarrative {
  narrative_id: string;
  generated_at: string;
  direction: string;
  recent_changes: string[];
  risks: string[];
  doctrine_evolution: string[];
  rendered: string;
}

let narrativeCounter = 0;

export function generateStrategicNarrative(): StrategicNarrative {
  narrativeCounter++;
  const constitution = getConstitutionState();
  const doctrines = getAllDoctrines();
  const canons = getActiveCanons();
  const culturalMemory = getAllCulturalMemory();

  const recentChanges: string[] = [];
  const risks: string[] = [];
  const doctrineEvolution: string[] = [];

  for (const d of doctrines) {
    doctrineEvolution.push(`${d.title} (priority ${d.priority}, ${d.immutable ? "immutable" : "mutable"})`);
  }

  if (constitution.emergency_freeze_active) {
    risks.push("Emergency freeze is active — runtime in locked state");
  }
  if (constitution.sovereignty_frozen) {
    risks.push("Sovereignty is frozen — no autonomy escalation possible");
  }
  if (constitution.violations.length > 0) {
    risks.push(`${constitution.violations.length} constitutional violations detected`);
  }

  const recentCanons = canons.filter((c) => {
    const age = Date.now() - new Date(c.created_at).getTime();
    return age < 7 * 24 * 60 * 60 * 1000;
  });
  for (const c of recentCanons) {
    recentChanges.push(`Canon registered: ${c.title} (${c.category})`);
  }

  const recentMemory = culturalMemory.slice(0, 3);
  for (const m of recentMemory) {
    recentChanges.push(`Cultural ${m.category}: ${m.title}`);
  }

  const lines: string[] = [
    "╔════════════════════════════════════════════╗",
    "║     STRATEGIC NARRATIVE                    ║",
    "╚════════════════════════════════════════════╝",
    `Direction: Runtime knowledge civilization — building persistent governed knowledge infrastructure`,
    `Active Doctrines: ${doctrines.length}`,
    `Active Canons: ${canons.length}`,
    `Epoch: ${constitution.epoch}`,
    `Freeze Status: ${constitution.emergency_freeze_active ? "FROZEN" : "Normal"}`,
    "",
    "--- Recent Changes ---",
    ...recentChanges.map((c) => `  • ${c}`),
    "",
    "--- Risks ---",
    ...(risks.length > 0 ? risks.map((r) => `  ⚠ ${r}`) : ["  No active risks"]),
    "",
    "--- Doctrine Evolution ---",
    ...doctrineEvolution.map((d) => `  • ${d}`),
  ];

  const narrative: StrategicNarrative = {
    narrative_id: `narrative_${Date.now()}_${narrativeCounter}`,
    generated_at: new Date().toISOString(),
    direction: "Runtime knowledge civilization — building persistent governed knowledge infrastructure",
    recent_changes: recentChanges,
    risks,
    doctrine_evolution: doctrineEvolution,
    rendered: lines.join("\n"),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(narrative.narrative_id, "strategic_narrative_generated"),
    trace_id: narrative.narrative_id,
    job_id: "knowledge",
    type: "strategic_narrative_generated",
    timestamp: narrative.generated_at,
    payload: {
      narrative_id: narrative.narrative_id,
      doctrines: doctrines.length,
      canons: canons.length,
      risks: risks.length,
    },
  });

  return narrative;
}
