import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

export type DependencyStatus = "pending" | "completed" | "blocked" | "failed";

export interface DependencyEntry {
  dep_id: string;
  plan_id: string;
  pack_id: string;
  depends_on: string;
  status: DependencyStatus;
  updated_at: string;
}

const DEPENDENCIES: Map<string, DependencyEntry> = new Map();
let depCounter = 0;

export async function updateDependencyStatus(
  planId: string,
  packId: string,
  dependsOn: string,
  status: DependencyStatus,
): Promise<DependencyEntry> {
  depCounter++;
  const entry: DependencyEntry = {
    dep_id: `dep_${Date.now()}_${depCounter}`,
    plan_id: planId,
    pack_id: packId,
    depends_on: dependsOn,
    status,
    updated_at: new Date().toISOString(),
  };

  DEPENDENCIES.set(entry.dep_id, entry);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(entry.dep_id, "plan_dependency_status_updated"),
    trace_id: entry.dep_id,
    job_id: "planning",
    type: "plan_dependency_status_updated",
    timestamp: entry.updated_at,
    payload: {
      dep_id: entry.dep_id,
      plan_id: planId,
      pack_id: packId,
      depends_on: dependsOn,
      status,
    },
  });

  return entry;
}

export function getDependenciesForPlan(planId: string): DependencyEntry[] {
  return Array.from(DEPENDENCIES.values()).filter((d) => d.plan_id === planId);
}

export function getBlockedDependencies(planId: string): DependencyEntry[] {
  return Array.from(DEPENDENCIES.values()).filter(
    (d) => d.plan_id === planId && (d.status === "blocked" || d.status === "failed"),
  );
}

export async function autoDetectDependencies(planId: string): Promise<DependencyEntry[]> {
  const evidence = readEvidenceRecords();
  const planEntries = evidence.filter((e) => e.payload?.plan_id === planId);
  const entries: DependencyEntry[] = [];

  for (let i = 1; i < planEntries.length; i++) {
    const entry = await updateDependencyStatus(
      planId,
      planEntries[i].evidence_id,
      planEntries[i - 1].evidence_id,
      "pending",
    );
    entries.push(entry);
  }

  return entries;
}
