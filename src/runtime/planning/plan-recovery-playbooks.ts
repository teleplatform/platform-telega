import { appendEvidenceRecord } from "../evidence/execution-evidence-store.js";
import { hashTraceId } from "../evidence/execution-hash.js";

export type PlaybookType = "blocker" | "drift" | "failed_pack" | "policy_friction" | "resource_exhaustion";

export interface RecoveryPlaybook {
  playbook_id: string;
  plan_id: string;
  playbook_type: PlaybookType;
  steps: string[];
  executed: boolean;
  created_at: string;
}

let playbookCounter = 0;

const PLAYBOOK_STEPS: Record<PlaybookType, string[]> = {
  blocker: [
    "Identify blocking pack",
    "Check dependency chain",
    "Rerun blocked pack with fresh resources",
    "Escalate to operator if still blocked",
  ],
  drift: [
    "Capture current drift delta",
    "Compare drift with approved plan",
    "Request plan amendment if drift > 20%",
    "Log drift to cultural memory",
  ],
  failed_pack: [
    "Capture pack failure evidence",
    "Rollback pack side effects",
    "Create incident for pack failure",
    "Retry pack with backoff",
  ],
  policy_friction: [
    "Identify conflicting policy",
    "Check doctrine alignment",
    "Request policy waiver if justified",
    "Log friction to risk ledger",
  ],
  resource_exhaustion: [
    "Freeze non-critical operations",
    "Reduce pack parallelism",
    "Request operator resource allocation",
    "Resume paused packs",
  ],
};

export function selectRecoveryPlaybook(planId: string, playbookType: PlaybookType): RecoveryPlaybook {
  playbookCounter++;
  const playbook: RecoveryPlaybook = {
    playbook_id: `pb_${Date.now()}_${playbookCounter}`,
    plan_id: planId,
    playbook_type: playbookType,
    steps: PLAYBOOK_STEPS[playbookType],
    executed: false,
    created_at: new Date().toISOString(),
  };

  appendEvidenceRecord({
    evidence_id: hashTraceId(playbook.playbook_id, "plan_recovery_playbook_selected"),
    trace_id: playbook.playbook_id,
    job_id: "planning",
    type: "plan_recovery_playbook_selected",
    timestamp: playbook.created_at,
    payload: {
      playbook_id: playbook.playbook_id,
      plan_id: planId,
      playbook_type,
      steps_count: playbook.steps.length,
    },
  });

  return playbook;
}

export async function executeRecoveryPlaybook(playbookId: string): Promise<RecoveryPlaybook | null> {
  playbookCounter++;
  const playbook: RecoveryPlaybook = {
    playbook_id: playbookId,
    plan_id: "",
    playbook_type: "blocker",
    steps: [],
    executed: true,
    created_at: new Date().toISOString(),
  };

  await appendEvidenceRecord({
    evidence_id: hashTraceId(`${playbookId}_exec`, "plan_recovery_playbook_executed"),
    trace_id: playbookId,
    job_id: "planning",
    type: "plan_recovery_playbook_executed",
    timestamp: new Date().toISOString(),
    payload: {
      playbook_id: playbookId,
      plan_id: playbook.plan_id,
      playbook_type: playbook.playbook_type,
    },
  });

  return playbook;
}
