/**
 * Governance Event Writer — X1.8
 *
 * Emits audit events and evidence anchors for all governance state transitions.
 * RULE: NO GOVERNANCE STATE TRANSITION WITHOUT AUDIT EVENT + EVIDENCE ANCHOR
 */

import type { GovernanceRepos } from "../repos/governanceRepos.js";

export type GovernanceEvidenceAnchorType =
  | "effect_confirmed"
  | "governance_transition"
  | "override_activated"
  | "amendment_applied"
  | "dispute_harmonized"
  | "continuity_transition";

export interface GovernanceEventWriterDeps {
  repos: GovernanceRepos;
}

export class GovernanceEventWriter {
  constructor(private readonly deps: GovernanceEventWriterDeps) {}

  emitAuditEvent(input: {
    constitutionId: string;
    eventType: string;
    actorId?: string;
    relatedEntityId?: string;
    summary: string;
    evidenceRefs: string[];
  }): string {
    const auditEventId = `const_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.deps.repos.insertAuditEvent({
      audit_event_id: auditEventId,
      constitution_id: input.constitutionId,
      event_type: input.eventType,
      actor_id: input.actorId ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      summary: input.summary,
      evidence_refs: JSON.stringify(input.evidenceRefs),
      timestamp: Date.now(),
    });

    return auditEventId;
  }

  buildEvidenceAnchor(input: {
    anchorType: GovernanceEvidenceAnchorType;
    entityId: string;
    traceId: string;
  }): string {
    return `${input.anchorType}:${input.entityId}:${input.traceId}`;
  }
}
