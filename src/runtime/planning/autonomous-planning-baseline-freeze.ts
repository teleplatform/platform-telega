import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActivePlans } from "./strategic-planning-engine.js";
import { getPendingProposals } from "./autonomous-planning-proposal-queue.js";

const BASELINE_DIR = path.join(process.cwd(), ".data", "planning");
const BASELINE_PATH = path.join(BASELINE_DIR, "planning-baseline.json");

export interface PlanningBaseline {
  frozen_at: string;
  active_plans: number;
  pending_proposals: number;
  orchestration_count: number;
  resource_pressure: boolean;
}

let baselineCounter = 0;

export async function freezePlanningBaseline(): Promise<PlanningBaseline> {
  baselineCounter++;

  const plans = getActivePlans();
  const proposals = getPendingProposals();

  if (!fs.existsSync(BASELINE_DIR)) {
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
  }

  const baseline: PlanningBaseline = {
    frozen_at: new Date().toISOString(),
    active_plans: plans.length,
    pending_proposals: proposals.length,
    orchestration_count: baselineCounter,
    resource_pressure: false,
  };

  fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2), { encoding: "utf8" });

  await appendEvidenceRecord({
    evidence_id: hashTraceId("planning_baseline", "planning_baseline_frozen"),
    trace_id: "planning_baseline",
    job_id: "planning",
    type: "planning_baseline_frozen",
    timestamp: baseline.frozen_at,
    payload: {
      active_plans: baseline.active_plans,
      pending_proposals: baseline.pending_proposals,
    },
  });

  return baseline;
}

export async function comparePlanningBaseline(): Promise<{
  previous: PlanningBaseline | null;
  current: PlanningBaseline;
  differences: string[];
}> {
  let previous: PlanningBaseline | null = null;
  if (fs.existsSync(BASELINE_PATH)) {
    try {
      previous = JSON.parse(fs.readFileSync(BASELINE_PATH, { encoding: "utf8" }));
    } catch {}
  }

  const current = await freezePlanningBaseline();
  const differences: string[] = [];

  if (previous) {
    if (previous.active_plans !== current.active_plans) {
      differences.push(`active plans: ${previous.active_plans} → ${current.active_plans}`);
    }
    if (previous.pending_proposals !== current.pending_proposals) {
      differences.push(`pending proposals: ${previous.pending_proposals} → ${current.pending_proposals}`);
    }
  }

  await appendEvidenceRecord({
    evidence_id: hashTraceId("planning_baseline_compare", "planning_baseline_compared"),
    trace_id: "planning_baseline",
    job_id: "planning",
    type: "planning_baseline_compared",
    timestamp: current.frozen_at,
    payload: {
      has_previous: !!previous,
      differences_count: differences.length,
      differences,
    },
  });

  return { previous, current, differences };
}
