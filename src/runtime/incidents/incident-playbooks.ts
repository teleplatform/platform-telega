import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type PlaybookType =
  | "evidence_corruption"
  | "federation_collapse"
  | "unauthorized_callback"
  | "policy_drift"
  | "replay_storm"
  | "failed_recovery"
  | "budget_exhaustion";

export interface PlaybookStep {
  step: string;
  description: string;
  requires_approval: boolean;
  timeout_ms: number;
}

export interface Playbook {
  playbook_id: string;
  type: PlaybookType;
  title: string;
  steps: PlaybookStep[];
}

const PLAYBOOKS: Record<PlaybookType, Playbook> = {
  evidence_corruption: {
    playbook_id: "pb_evidence_corruption",
    type: "evidence_corruption",
    title: "Evidence Corruption Response",
    steps: [
      { step: "isolate_evidence_store", description: "Isolate corrupted evidence store", requires_approval: true, timeout_ms: 10000 },
      { step: "validate_backup", description: "Validate latest backup integrity", requires_approval: false, timeout_ms: 30000 },
      { step: "restore_evidence", description: "Restore evidence from backup", requires_approval: true, timeout_ms: 60000 },
      { step: "verify_restoration", description: "Verify restored evidence integrity", requires_approval: false, timeout_ms: 30000 },
    ],
  },
  federation_collapse: {
    playbook_id: "pb_federation_collapse",
    type: "federation_collapse",
    title: "Federation Collapse Response",
    steps: [
      { step: "freeze_federation", description: "Freeze federation state", requires_approval: true, timeout_ms: 5000 },
      { step: "identify_surviving_nodes", description: "Identify surviving healthy nodes", requires_approval: false, timeout_ms: 15000 },
      { step: "reestablish_minimal_mesh", description: "Reestablish minimal federation mesh", requires_approval: true, timeout_ms: 30000 },
      { step: "verify_consensus", description: "Verify consensus among surviving nodes", requires_approval: false, timeout_ms: 20000 },
    ],
  },
  unauthorized_callback: {
    playbook_id: "pb_unauthorized_callback",
    type: "unauthorized_callback",
    title: "Unauthorized Callback Response",
    steps: [
      { step: "block_callback", description: "Block unauthorized callback immediately", requires_approval: true, timeout_ms: 5000 },
      { step: "audit_callback_trail", description: "Audit callback trail for scope", requires_approval: false, timeout_ms: 20000 },
      { step: "revoke_access", description: "Revoke access for compromised surface", requires_approval: true, timeout_ms: 10000 },
      { step: "notify_operator", description: "Notify operator of incident", requires_approval: false, timeout_ms: 5000 },
    ],
  },
  policy_drift: {
    playbook_id: "pb_policy_drift",
    type: "policy_drift",
    title: "Policy Drift Response",
    steps: [
      { step: "capture_drift", description: "Capture current policy drift state", requires_approval: false, timeout_ms: 10000 },
      { step: "compare_with_baseline", description: "Compare with baseline freeze", requires_approval: false, timeout_ms: 15000 },
      { step: "propose_restoration", description: "Propose policy restoration plan", requires_approval: true, timeout_ms: 20000 },
      { step: "apply_correction", description: "Apply policy correction", requires_approval: true, timeout_ms: 15000 },
    ],
  },
  replay_storm: {
    playbook_id: "pb_replay_storm",
    type: "replay_storm",
    title: "Replay Storm Response",
    steps: [
      { step: "throttle_replays", description: "Throttle all replay requests", requires_approval: true, timeout_ms: 5000 },
      { step: "analyze_source", description: "Analyze replay storm source", requires_approval: false, timeout_ms: 20000 },
      { step: "block_abusive_nodes", description: "Block abusive replay sources", requires_approval: true, timeout_ms: 10000 },
      { step: "recover_normal_rate", description: "Gradually restore normal replay rate", requires_approval: false, timeout_ms: 30000 },
    ],
  },
  failed_recovery: {
    playbook_id: "pb_failed_recovery",
    type: "failed_recovery",
    title: "Failed Recovery Response",
    steps: [
      { step: "assess_failure_impact", description: "Assess impact of failed recovery", requires_approval: false, timeout_ms: 15000 },
      { step: "rollback_recovery", description: "Rollback failed recovery attempt", requires_approval: true, timeout_ms: 20000 },
      { step: "escalate_to_sovereign", description: "Escalate to sovereign recovery", requires_approval: true, timeout_ms: 10000 },
      { step: "notify_mission_control", description: "Notify Mission Control", requires_approval: false, timeout_ms: 5000 },
    ],
  },
  budget_exhaustion: {
    playbook_id: "pb_budget_exhaustion",
    type: "budget_exhaustion",
    title: "Budget Exhaustion Response",
    steps: [
      { step: "freeze_expensive_operations", description: "Freeze expensive runtime operations", requires_approval: true, timeout_ms: 10000 },
      { step: "audit_current_spend", description: "Audit current resource spend", requires_approval: false, timeout_ms: 20000 },
      { step: "reallocate_budget", description: "Reallocate budget to critical paths", requires_approval: true, timeout_ms: 15000 },
      { step: "notify_operator", description: "Notify operator of budget pressure", requires_approval: false, timeout_ms: 5000 },
    ],
  },
};

export async function selectPlaybook(type: PlaybookType): Promise<Playbook> {
  const playbook = PLAYBOOKS[type];

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`pb_${type}`, "incident_playbook_selected"),
    trace_id: `pb_${type}`,
    job_id: "incidents",
    type: "incident_playbook_selected",
    timestamp: new Date().toISOString(),
    payload: {
      playbook_id: playbook.playbook_id,
      type,
      steps_count: playbook.steps.length,
    },
  });

  return { ...playbook, steps: [...playbook.steps] };
}

export async function executePlaybookStep(
  playbook: Playbook,
  stepIndex: number,
): Promise<{ executed: boolean; step: PlaybookStep }> {
  const step = playbook.steps[stepIndex];
  if (!step) throw new Error(`Step ${stepIndex} not found in playbook ${playbook.playbook_id}`);

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${playbook.playbook_id}_step_${stepIndex}`, "incident_playbook_step_executed"),
    trace_id: playbook.playbook_id,
    job_id: "incidents",
    type: "incident_playbook_step_executed",
    timestamp: new Date().toISOString(),
    payload: {
      playbook_id: playbook.playbook_id,
      step_index: stepIndex,
      step: step.step,
      requires_approval: step.requires_approval,
    },
  });

  return { executed: true, step };
}

export function getPlaybooks(): Playbook[] {
  return Object.values(PLAYBOOKS).map((p) => ({ ...p, steps: [...p.steps] }));
}

export function getPlaybook(type: PlaybookType): Playbook {
  return { ...PLAYBOOKS[type], steps: [...PLAYBOOKS[type].steps] };
}
