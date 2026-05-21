import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getConstitutionState } from "../constitution/runtime-constitution.js";
import { getAllDoctrines } from "./runtime-doctrine-registry.js";
import { getAllCulturalMemory } from "./runtime-cultural-memory.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

export interface DriftEntry {
  drift_id: string;
  type: "doctrine_vs_constitution" | "doctrine_vs_policy" | "doctrine_vs_behavior" | "constitution_vs_behavior";
  description: string;
  severity: "warning" | "major" | "critical";
  detected_at: string;
  resolved: boolean;
}

let driftCounter = 0;

export function detectDoctrineDrift(): DriftEntry[] {
  driftCounter++;
  const drifts: DriftEntry[] = [];

  const constitution = getConstitutionState();
  const doctrines = getAllDoctrines();
  const evidence = readEvidenceRecords();

  for (const d of doctrines) {
    if (d.title === "No Silent Mutation" && constitution.rules_active.length === 0) {
      drifts.push({
        drift_id: `drift_${Date.now()}_${driftCounter}`,
        type: "doctrine_vs_constitution",
        description: `"${d.title}" requires active rules but constitution has none`,
        severity: "major",
        detected_at: new Date().toISOString(),
        resolved: false,
      });
    }

    if (d.title === "Creator Sovereignty" && constitution.sovereignty_frozen) {
      drifts.push({
        drift_id: `drift_${Date.now()}_${driftCounter}`,
        type: "doctrine_vs_constitution",
        description: `"${d.title}" asserts creator sovereignty but sovereignty is frozen`,
        severity: "critical",
        detected_at: new Date().toISOString(),
        resolved: false,
      });
    }

    if (d.title === "Runtime Survival First" && constitution.emergency_freeze_active) {
      drifts.push({
        drift_id: `drift_${Date.now()}_${driftCounter}`,
        type: "doctrine_vs_behavior",
        description: `"${d.title}" mandates survival first but emergency freeze is active`,
        severity: "warning",
        detected_at: new Date().toISOString(),
        resolved: false,
      });
    }
  }

  const doctrineEnforcementEvents = evidence.filter((e) =>
    e.type === "doctrine_enforcement_blocked",
  );
  if (doctrineEnforcementEvents.length > 3) {
    drifts.push({
      drift_id: `drift_${Date.now()}_${driftCounter}`,
      type: "doctrine_vs_behavior",
      description: `Doctrine enforcement blocked ${doctrineEnforcementEvents.length} times — persistent drift`,
      severity: "major",
      detected_at: new Date().toISOString(),
      resolved: false,
    });
  }

  for (const d of drifts) {
    appendEvidenceRecord({
      evidence_id: hashTraceId(d.drift_id, "doctrine_drift_detected"),
      trace_id: d.drift_id,
      job_id: "knowledge",
      type: "doctrine_drift_detected",
      timestamp: d.detected_at,
      payload: {
        drift_id: d.drift_id,
        drift_type: d.type,
        severity: d.severity,
        description: d.description,
      },
    });
  }

  return drifts;
}

export async function resolveDrift(driftId: string): Promise<boolean> {
  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${driftId}_resolved`, "doctrine_drift_resolved"),
    trace_id: driftId,
    job_id: "knowledge",
    type: "doctrine_drift_resolved",
    timestamp: new Date().toISOString(),
    payload: { drift_id: driftId },
  });

  return true;
}
