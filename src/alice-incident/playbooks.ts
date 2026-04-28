// ─────────────────────────────────────────────────────────────
// ALICE INCIDENT / RECOVERY DISCIPLINE PACK v1.0 — Recovery Playbooks
//
// Bounded recovery playbooks for v1:
// - recheck_ingress
// - recheck_protocol
// - recheck_bridge
// - fallback_containment
// - safe_hold
// - manual_disable
// - controlled_restore
//
// This is NOT shell automation — it's governed recovery discipline.
// ─────────────────────────────────────────────────────────────

import type { AliceRecoveryPlaybook, AliceIncidentRecord } from "./types.js";

const PLAYBOOKS: AliceRecoveryPlaybook[] = [
  {
    playbookId: "recheck_ingress",
    description: "Verify ingress endpoint reachability and response behavior",
    targetTrigger: "ingress_failure",
  },
  {
    playbookId: "recheck_protocol",
    description: "Verify protocol adapter processing and mapping integrity",
    targetTrigger: "protocol_failure",
  },
  {
    playbookId: "recheck_bridge",
    description: "Verify bridge adapter handling voice session behavior",
    targetTrigger: "bridge_failure",
  },
  {
    playbookId: "fallback_containment",
    description: "Ensure safe fallback is available and not overused",
    targetTrigger: "repeated_fallback",
  },
  {
    playbookId: "safe_hold",
    description: "Place system in held state to prevent further degradation",
    targetTrigger: "unsafe_response_path",
  },
  {
    playbookId: "manual_disable",
    description: "Intentionally disable live surface — operator decision required",
    targetTrigger: "manual_operator_action",
  },
  {
    playbookId: "controlled_restore",
    description: "Attempt controlled restoration from held/degraded to live",
    targetTrigger: "ingress_failure", // Can be used for various triggers after initial containment
  },
];

export function selectAliceRecoveryPlaybook(trigger: AliceIncidentRecord["trigger"]): AliceRecoveryPlaybook[] {
  // Find playbooks targeting this trigger
  const matching = PLAYBOOKS.filter((p) => p.targetTrigger === trigger);

  // If no exact match, return safe_hold as default
  if (matching.length === 0) {
    const safeHold = PLAYBOOKS.find((p) => p.playbookId === "safe_hold")!;
    return [safeHold];
  }

  return matching;
}

export function getAllPlaybooks(): AliceRecoveryPlaybook[] {
  return [...PLAYBOOKS];
}

export function getPlaybookDescription(playbookId: AliceRecoveryPlaybook["playbookId"]): string {
  const playbook = PLAYBOOKS.find((p) => p.playbookId === playbookId);
  return playbook?.description ?? `Unknown playbook: ${playbookId}`;
}
