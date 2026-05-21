import fs from "node:fs";
import path from "node:path";
import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";
import { getActivePlans } from "./strategic-planning-engine.js";
import { readEvidenceRecords } from "../evidence/execution-evidence-store.js";

const FREEZE_DIR = path.join(process.cwd(), ".data", "planning");
const FREEZE_PATH = path.join(FREEZE_DIR, "planning-civilization-freeze.json");

export interface PlanningCivilizationFreeze {
  frozen_at: string;
  total_plans: number;
  active_plans: number;
  total_evidence: number;
  archived_plans: number;
  recovery_playbooks: number;
  learning_proposals: number;
  canon_candidates: number;
}

export async function freezePlanningCivilization(): Promise<PlanningCivilizationFreeze> {
  if (!fs.existsSync(FREEZE_DIR)) {
    fs.mkdirSync(FREEZE_DIR, { recursive: true });
  }

  const plans = getActivePlans();
  const evidence = readEvidenceRecords();

  const freeze: PlanningCivilizationFreeze = {
    frozen_at: new Date().toISOString(),
    total_plans: plans.length + 1,
    active_plans: plans.filter((p) => p.status === "active" || p.status === "draft").length,
    total_evidence: evidence.length,
    archived_plans: 0,
    recovery_playbooks: evidence.filter((e) => e.type === "plan_recovery_playbook_selected").length,
    learning_proposals: evidence.filter((e) => e.type === "plan_learning_proposal_created").length,
    canon_candidates: evidence.filter((e) => e.type === "plan_canon_promotion_candidate_created").length,
  };

  fs.writeFileSync(FREEZE_PATH, JSON.stringify(freeze, null, 2), { encoding: "utf8" });

  await appendEvidenceRecord({
    evidence_id: hashTraceId("planning_civ_freeze", "planning_civilization_freeze_created"),
    trace_id: "planning_civ_freeze",
    job_id: "planning",
    type: "planning_civilization_freeze_created",
    timestamp: freeze.frozen_at,
    payload: {
      total_plans: freeze.total_plans,
      active_plans: freeze.active_plans,
      total_evidence: freeze.total_evidence,
      recovery_playbooks: freeze.recovery_playbooks,
      learning_proposals: freeze.learning_proposals,
    },
  });

  return freeze;
}
