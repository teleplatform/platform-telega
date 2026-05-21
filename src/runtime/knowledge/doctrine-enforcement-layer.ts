import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getAllDoctrines, type DoctrineEntry } from "./runtime-doctrine-registry.js";
import { getConstitutionState } from "../constitution/runtime-constitution.js";

export type EnforcementContext =
  | "evolution"
  | "federation"
  | "dangerous_execution"
  | "diplomacy"
  | "autonomy_escalation";

export interface EnforcementResult {
  context: EnforcementContext;
  blocked: boolean;
  violated_doctrines: Array<{ doctrine_id: string; title: string; statement: string }>;
}

export async function enforceDoctrines(context: EnforcementContext): Promise<EnforcementResult> {
  const doctrines = getAllDoctrines();
  const constitution = getConstitutionState();

  const violated: Array<{ doctrine_id: string; title: string; statement: string }> = [];

  for (const d of doctrines) {
    if (constitution.emergency_freeze_active && d.category === "survival") {
      continue;
    }

    if (d.title === "No Silent Mutation" && context === "evolution") {
      violated.push({ doctrine_id: d.doctrine_id, title: d.title, statement: d.statement });
    }
    if (d.title === "Federation Integrity" && context === "federation" && constitution.sovereignty_frozen) {
      violated.push({ doctrine_id: d.doctrine_id, title: d.title, statement: d.statement });
    }
    if (d.title === "Runtime Survival First" && context === "dangerous_execution") {
      violated.push({ doctrine_id: d.doctrine_id, title: d.title, statement: d.statement });
    }
    if (d.title === "Governed Autonomy" && context === "autonomy_escalation") {
      violated.push({ doctrine_id: d.doctrine_id, title: d.title, statement: d.statement });
    }
  }

  const blocked = violated.length > 0;

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`doctrine_${context}`, blocked ? "doctrine_enforcement_blocked" : "doctrine_enforcement_checked"),
    trace_id: `doctrine_${context}`,
    job_id: "knowledge",
    type: blocked ? "doctrine_enforcement_blocked" : "doctrine_enforcement_checked",
    timestamp: new Date().toISOString(),
    payload: {
      context,
      blocked,
      violations: violated.length,
      violated_doctrines: violated.map((v) => v.title),
    },
  });

  return { context, blocked, violated_doctrines: violated };
}
