import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActivePlans } from "./strategic-planning-engine.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

const BASELINE_DIR = path.join(process.cwd(), ".data", "planning");
const BASELINE_PATH = path.join(BASELINE_DIR, "plan-execution-baseline.json");

export interface PlanExecutionBaseline {
  frozen_at: string;
  active_executions: number;
  completed_packs: number;
  blocked_packs: number;
  drifts_detected: number;
}

export async function freezePlanExecutionBaseline(): Promise<PlanExecutionBaseline> {
  const plans = getActivePlans();
  const evidence = readEvidenceRecords();

  const executions = evidence.filter((e) => e.type === "governed_plan_execution_started").length;
  const packs = evidence.filter((e) => e.type === "plan_pack_materialized").length;
  const blocked = evidence.filter((e) => e.type === "plan_progress_blocked").length;
  const drifts = evidence.filter((e) => e.type === "plan_drift_detected" || e.type === "plan_drift_escalated").length;

  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
  }

  const baseline: PlanExecutionBaseline = {
    frozen_at: new Date().toISOString(),
    active_executions: plans.length,
    completed_packs: packs,
    blocked_packs: blocked,
    drifts_detected: drifts,
  };

  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), { encoding: "utf8" });

  await appendEvidenceRecord({
    evidence_id: hashTraceId("plan_exec_baseline", "plan_execution_baseline_frozen"),
    trace_id: "plan_exec_baseline",
    job_id: "planning",
    type: "plan_execution_baseline_frozen",
    timestamp: baseline.frozen_at,
    payload: {
      active_executions: baseline.active_executions,
      completed_packs: baseline.completed_packs,
      blocked_packs: baseline.blocked_packs,
      drifts: baseline.drifts_detected,
    },
  });

  return baseline;
}

export async function comparePlanExecutionBaseline(): Promise<{
  previous: PlanExecutionBaseline | null;
  current: PlanExecutionBaseline;
  differences: string[];
}> {
  let previous: PlanExecutionBaseline | null = null;
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      previous = JSON.parse(fs.readFileSync(BASELINE_PATH, { encoding: "utf8" }));
    } catch {}
  }

  const current = await freezePlanExecutionBaseline();
  const differences: string[] = [];

  if (previous) {
    if (previous.active_executions !== current.active_executions) {
      differences.push(`active executions: ${previous.active_executions} → ${current.active_executions}`);
    }
    if (previous.completed_packs !== current.completed_packs) {
      differences.push(`completed packs: ${previous.completed_packs} → ${current.completed_packs}`);
    }
    if (previous.blocked_packs !== current.blocked_packs) {
      differences.push(`blocked packs: ${previous.blocked_packs} → ${current.blocked_packs}`);
    }
    if (previous.drifts_detected !== current.drifts_detected) {
      differences.push(`drifts: ${previous.drifts_detected} → ${current.drifts_detected}`);
    }
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId("plan_exec_baseline_compare", "plan_execution_baseline_compared"),
    trace_id: "plan_exec_baseline",
    job_id: "planning",
    type: "plan_execution_baseline_compared",
    timestamp: current.frozen_at,
    payload: {
      has_previous: !!previous,
      differences_count: differences.length,
      differences,
    },
  });

  return { previous, current, differences };
}
