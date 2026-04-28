/**
 * Governance Application Services — X2.0
 *
 * Orchestrates: input → repos + events → state changes
 */

import type { GovernanceRepos } from "../repos/governanceRepos.js";
import type { GovernanceEventWriter } from "../events/governanceEventWriter.js";

// ============================================================================
// Governance Service
// ============================================================================

export class GovernanceService {
  constructor(
    private readonly repos: GovernanceRepos,
    private readonly events: GovernanceEventWriter,
  ) {}

  processIncident(input: {
    constitutionId: string;
    traceId: string;
    patternType: string;
    recurrenceScore: number;
  }): string {
    const patternId = `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.repos.insertIncidentPattern({
      pattern_id: patternId,
      pattern_type: input.patternType,
      source_closure_ids: JSON.stringify([]),
      source_trace_ids: JSON.stringify([input.traceId]),
      recurrence_score: input.recurrenceScore,
      severity_trend: "stable",
      detected_at: Date.now(),
    });

    const evidenceAnchor = this.events.buildEvidenceAnchor({
      anchorType: "effect_confirmed",
      entityId: patternId,
      traceId: input.traceId,
    });

    this.events.emitAuditEvent({
      constitutionId: input.constitutionId,
      eventType: "incident_pattern_detected",
      relatedEntityId: patternId,
      summary: `New incident pattern recorded: ${input.patternType}`,
      evidenceRefs: [evidenceAnchor],
    });

    return patternId;
  }

  ratifyDoctrine(input: {
    constitutionId: string;
    doctrineType: string;
    supportingPatternIds: string[];
    supportingLearningIds: string[];
    doctrineStrength: number;
    enforcementLevel: "advisory" | "strong" | "mandatory";
  }): string {
    const doctrineId = `doctrine_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.repos.insertDoctrine({
      doctrine_id: doctrineId,
      doctrine_type: input.doctrineType,
      supporting_pattern_ids: JSON.stringify(input.supportingPatternIds),
      supporting_learning_ids: JSON.stringify(input.supportingLearningIds),
      doctrine_strength: input.doctrineStrength,
      enforcement_level: input.enforcementLevel,
      ratified_at: Date.now(),
    });

    this.events.emitAuditEvent({
      constitutionId: input.constitutionId,
      eventType: "doctrine_ratified",
      relatedEntityId: doctrineId,
      summary: `Operational doctrine ratified: ${input.doctrineType}`,
      evidenceRefs: [`doctrine_ratified:${doctrineId}`],
    });

    return doctrineId;
  }

  getIncidentPatterns(limit = 20) {
    return this.repos.listIncidentPatterns(limit);
  }

  getDoctrines(limit = 20) {
    return this.repos.listDoctrines(limit);
  }

  getAuditEvents(constitutionId: string, limit = 50) {
    return this.repos.getAuditEventsByConstitution(constitutionId, limit);
  }
}

// ============================================================================
// Constitution Orchestrator
// ============================================================================

export class ConstitutionOrchestrator {
  constructor(
    private readonly repos: GovernanceRepos,
    private readonly events: GovernanceEventWriter,
  ) {}

  updateConstitution(input: {
    constitutionId: string;
    doctrineIds: string[];
    conflictIds: string[];
    judgmentIds: string[];
    overrideIds: string[];
    operatorAuthorityIds: string[];
    constitutionalState: "stable" | "guarded" | "restricted" | "emergency";
    legitimacyScore: number;
    governanceCoherenceScore: number;
  }): string {
    this.repos.upsertConstitution({
      constitution_id: input.constitutionId,
      active_doctrine_ids: JSON.stringify(input.doctrineIds),
      active_conflict_ids: JSON.stringify(input.conflictIds),
      active_judgment_ids: JSON.stringify(input.judgmentIds),
      active_override_ids: JSON.stringify(input.overrideIds),
      active_operator_authority_ids: JSON.stringify(input.operatorAuthorityIds),
      constitutional_state: input.constitutionalState,
      legitimacy_score: input.legitimacyScore,
      governance_coherence_score: input.governanceCoherenceScore,
      last_ratified_at: Date.now(),
    });

    this.events.emitAuditEvent({
      constitutionId: input.constitutionId,
      eventType: "constitution_updated",
      summary: `Live governance constitution updated: state=${input.constitutionalState}`,
      evidenceRefs: [`constitution_updated:${input.constitutionId}`],
    });

    return input.constitutionId;
  }

  getConstitution(constitutionId: string) {
    return this.repos.getConstitution(constitutionId);
  }

  getLatestLegitimacy(constitutionId: string) {
    return this.repos.getLatestLegitimacy(constitutionId);
  }
}

// ============================================================================
// Oversight Coordinator
// ============================================================================

export class OversightCoordinator {
  constructor(
    private readonly repos: GovernanceRepos,
    private readonly events: GovernanceEventWriter,
  ) {}

  evaluateSystem(input: {
    constitutionId: string;
    driftScore: number;
    pressureScore: number;
    overrideCount: number;
    conflictCount: number;
  }): "stable" | "watch" | "escalate" {
    const riskScore = Math.round(
      (input.driftScore + input.pressureScore) / 2,
    );

    if (riskScore > 70 || input.overrideCount > 5 || input.conflictCount > 3) {
      this.events.emitAuditEvent({
        constitutionId: input.constitutionId,
        eventType: "governance_risk_detected",
        summary: `High drift (${input.driftScore}) or pressure (${input.pressureScore}) detected`,
        evidenceRefs: [`risk_assessed:${input.constitutionId}`],
      });

      return "escalate";
    }

    if (riskScore > 40) {
      return "watch";
    }

    return "stable";
  }

  recordLegitimacy(input: {
    constitutionId: string;
    doctrineCoherenceScore: number;
    operatorAuthorityValidityScore: number;
    overrideDisciplineScore: number;
    auditCompletenessScore: number;
    liveGovernanceConsistencyScore: number;
  }): string {
    const aggregateLegitimacyScore = Math.round(
      (
        input.doctrineCoherenceScore +
        input.operatorAuthorityValidityScore +
        input.overrideDisciplineScore +
        input.auditCompletenessScore +
        input.liveGovernanceConsistencyScore
      ) / 5,
    );

    const legitimacyState =
      aggregateLegitimacyScore >= 85
        ? "legitimate"
        : aggregateLegitimacyScore >= 65
          ? "fragile"
          : aggregateLegitimacyScore >= 40
            ? "contested"
            : "invalid";

    const legitimacyId = `legitimacy_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.repos.upsertLegitimacy({
      legitimacy_id: legitimacyId,
      constitution_id: input.constitutionId,
      doctrine_coherence_score: input.doctrineCoherenceScore,
      operator_authority_validity_score: input.operatorAuthorityValidityScore,
      override_discipline_score: input.overrideDisciplineScore,
      audit_completeness_score: input.auditCompletenessScore,
      live_governance_consistency_score: input.liveGovernanceConsistencyScore,
      aggregate_legitimacy_score: aggregateLegitimacyScore,
      legitimacy_state: legitimacyState,
      evaluated_at: Date.now(),
    });

    this.events.emitAuditEvent({
      constitutionId: input.constitutionId,
      eventType: "legitimacy_evaluated",
      relatedEntityId: legitimacyId,
      summary: `Constitutional legitimacy evaluated: ${legitimacyState} (${aggregateLegitimacyScore}%)`,
      evidenceRefs: [`legitimacy_evaluated:${legitimacyId}`],
    });

    return legitimacyId;
  }

  recordSovereignReadiness(input: {
    constitutionId: string;
    boundaryState: string;
    externalInterfaceState: string;
    federationReadinessState: string;
    stressReadinessState: string;
    closureDecision: string;
    rationale: string;
  }): string {
    const closureId = `sovereign_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.repos.insertSovereignReadiness({
      closure_id: closureId,
      constitution_id: input.constitutionId,
      boundary_state: input.boundaryState,
      external_interface_state: input.externalInterfaceState,
      federation_readiness_state: input.federationReadinessState,
      stress_readiness_state: input.stressReadinessState,
      closure_decision: input.closureDecision,
      rationale: input.rationale,
      decided_at: Date.now(),
    });

    return closureId;
  }

  recordContinuity(input: {
    constitutionId: string;
    memoryIntegrityState: string;
    driftState: string;
    generationalStabilityState: string;
    longCycleState: string;
    closureDecision: string;
    rationale: string;
  }): string {
    const closureId = `continuity_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    this.repos.insertContinuity({
      closure_id: closureId,
      constitution_id: input.constitutionId,
      memory_integrity_state: input.memoryIntegrityState,
      drift_state: input.driftState,
      generational_stability_state: input.generationalStabilityState,
      long_cycle_state: input.longCycleState,
      closure_decision: input.closureDecision,
      rationale: input.rationale,
      decided_at: Date.now(),
    });

    return closureId;
  }
}

// ============================================================================
// Read Models
// ============================================================================

export interface ConstitutionHealthView {
  constitutionId: string;
  constitutionalState: string;
  legitimacyScore: number;
  governanceCoherenceScore: number;
  activeDoctrineCount: number;
  activeConflictCount: number;
  activeOverrideCount: number;
  lastRatifiedAt: number;
}

export interface SovereignReadinessView {
  constitutionId: string;
  boundaryState: string;
  externalInterfaceState: string;
  federationReadinessState: string;
  stressReadinessState: string;
  closureDecision: string;
  decidedAt: number;
}

export interface CivilizationalContinuityView {
  constitutionId: string;
  memoryIntegrityState: string;
  driftState: string;
  generationalStabilityState: string;
  longCycleState: string;
  closureDecision: string;
  decidedAt: number;
}

export class GovernanceReadModels {
  constructor(private readonly repos: GovernanceRepos) {}

  getConstitutionHealth(constitutionId: string): ConstitutionHealthView | null {
    const row = this.repos.getConstitution(constitutionId);
    if (!row) return null;

    return {
      constitutionId: row.constitution_id,
      constitutionalState: row.constitutional_state,
      legitimacyScore: row.legitimacy_score,
      governanceCoherenceScore: row.governance_coherence_score,
      activeDoctrineCount: JSON.parse(row.active_doctrine_ids).length,
      activeConflictCount: JSON.parse(row.active_conflict_ids).length,
      activeOverrideCount: JSON.parse(row.active_override_ids).length,
      lastRatifiedAt: row.last_ratified_at,
    };
  }

  getSovereignReadiness(constitutionId: string): SovereignReadinessView | null {
    const row = this.repos.getLatestSovereignReadiness(constitutionId);
    if (!row) return null;

    return {
      constitutionId: row.constitution_id,
      boundaryState: row.boundary_state,
      externalInterfaceState: row.external_interface_state,
      federationReadinessState: row.federation_readiness_state,
      stressReadinessState: row.stress_readiness_state,
      closureDecision: row.closure_decision,
      decidedAt: row.decided_at,
    };
  }

  getContinuity(constitutionId: string): CivilizationalContinuityView | null {
    const row = this.repos.getLatestContinuity(constitutionId);
    if (!row) return null;

    return {
      constitutionId: row.constitution_id,
      memoryIntegrityState: row.memory_integrity_state,
      driftState: row.drift_state,
      generationalStabilityState: row.generational_stability_state,
      longCycleState: row.long_cycle_state,
      closureDecision: row.closure_decision,
      decidedAt: row.decided_at,
    };
  }
}
