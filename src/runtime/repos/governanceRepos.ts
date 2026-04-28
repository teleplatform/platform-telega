/**
 * Governance Runtime Repositories — X1.7
 *
 * Wires governance domain entities to SQLite via better-sqlite3.
 * Follows the storage pattern already established in src/server/storage/sqlite.ts
 */

import Database from "better-sqlite3";

// ============================================================================
// Domain types (matching schema)
// ============================================================================

export interface RuntimeIncidentPatternRow {
  pattern_id: string;
  pattern_type: string;
  source_closure_ids: string;    // JSON
  source_trace_ids: string;      // JSON
  recurrence_score: number;
  severity_trend: string;
  detected_at: number;
}

export interface OperationalDoctrineRow {
  doctrine_id: string;
  doctrine_type: string;
  supporting_pattern_ids: string;  // JSON
  supporting_learning_ids: string; // JSON
  doctrine_strength: number;
  enforcement_level: string;
  ratified_at: number;
}

export interface LiveGovernanceConstitutionRow {
  constitution_id: string;
  active_doctrine_ids: string;       // JSON
  active_conflict_ids: string;       // JSON
  active_judgment_ids: string;       // JSON
  active_override_ids: string;       // JSON
  active_operator_authority_ids: string; // JSON
  constitutional_state: string;
  legitimacy_score: number;
  governance_coherence_score: number;
  last_ratified_at: number;
}

export interface ConstitutionalAuditEventRow {
  audit_event_id: string;
  constitution_id: string;
  event_type: string;
  actor_id: string | null;
  related_entity_id: string | null;
  summary: string;
  evidence_refs: string;             // JSON
  timestamp: number;
}

export interface SovereignReadinessRow {
  closure_id: string;
  constitution_id: string;
  boundary_state: string;
  external_interface_state: string;
  federation_readiness_state: string;
  stress_readiness_state: string;
  closure_decision: string;
  rationale: string;
  decided_at: number;
}

export interface GovernanceSynthesisRow {
  closure_id: string;
  orchestration_id: string;
  orchestration_state: string;
  legitimacy_synthesis_state: string;
  dispute_harmonization_state: string;
  constitutional_intelligence_state: string;
  closure_decision: string;
  rationale: string;
  decided_at: number;
}

export interface CivilizationalContinuityRow {
  closure_id: string;
  constitution_id: string;
  memory_integrity_state: string;
  drift_state: string;
  generational_stability_state: string;
  long_cycle_state: string;
  closure_decision: string;
  rationale: string;
  decided_at: number;
}

export interface ConstitutionalLegitimacyRow {
  legitimacy_id: string;
  constitution_id: string;
  doctrine_coherence_score: number;
  operator_authority_validity_score: number;
  override_discipline_score: number;
  audit_completeness_score: number;
  live_governance_consistency_score: number;
  aggregate_legitimacy_score: number;
  legitimacy_state: string;
  evaluated_at: number;
}

// ============================================================================
// Database interface (compatible with existing sqlite.ts pattern)
// ============================================================================

export interface SqliteLikeDb {
  prepare(sql: string): {
    get(...args: unknown[]): unknown | undefined;
    all(...args: unknown[]): unknown[];
    run(...args: unknown[]): { changes: number; lastInsertRowid: unknown };
  };
  exec(sql: string): void;
  transaction<T>(fn: (...args: unknown[]) => T): (...args: unknown[]) => T;
}

// ============================================================================
// Governance Repositories
// ============================================================================

export class GovernanceRepos {
  private readonly insertIncidentPatternStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly getIncidentPatternStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly listIncidentPatternsStmt: ReturnType<SqliteLikeDb["prepare"]>;

  private readonly insertDoctrineStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly getDoctrineStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly listDoctrinesStmt: ReturnType<SqliteLikeDb["prepare"]>;

  private readonly upsertConstitutionStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly getConstitutionStmt: ReturnType<SqliteLikeDb["prepare"]>;

  private readonly insertAuditEventStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly getAuditEventsStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly getAuditEventsByConstitutionStmt: ReturnType<SqliteLikeDb["prepare"]>;

  private readonly upsertLegitimacyStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly getLegitimacyStmt: ReturnType<SqliteLikeDb["prepare"]>;

  private readonly insertSovereignReadinessStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly getLatestSovereignReadinessStmt: ReturnType<SqliteLikeDb["prepare"]>;

  private readonly insertSynthesisStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly getLatestSynthesisStmt: ReturnType<SqliteLikeDb["prepare"]>;

  private readonly insertContinuityStmt: ReturnType<SqliteLikeDb["prepare"]>;
  private readonly getLatestContinuityStmt: ReturnType<SqliteLikeDb["prepare"]>;

  constructor(private readonly db: SqliteLikeDb) {
    // Incident patterns
    this.insertIncidentPatternStmt = db.prepare(`
      INSERT INTO runtime_incident_patterns (
        pattern_id, pattern_type, source_closure_ids, source_trace_ids,
        recurrence_score, severity_trend, detected_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.getIncidentPatternStmt = db.prepare(`
      SELECT * FROM runtime_incident_patterns WHERE pattern_id = ?
    `);
    this.listIncidentPatternsStmt = db.prepare(`
      SELECT * FROM runtime_incident_patterns ORDER BY detected_at DESC LIMIT ?
    `);

    // Doctrines
    this.insertDoctrineStmt = db.prepare(`
      INSERT INTO operational_doctrines (
        doctrine_id, doctrine_type, supporting_pattern_ids,
        supporting_learning_ids, doctrine_strength, enforcement_level, ratified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.getDoctrineStmt = db.prepare(`
      SELECT * FROM operational_doctrines WHERE doctrine_id = ?
    `);
    this.listDoctrinesStmt = db.prepare(`
      SELECT * FROM operational_doctrines ORDER BY ratified_at DESC LIMIT ?
    `);

    // Constitution
    this.upsertConstitutionStmt = db.prepare(`
      INSERT INTO live_governance_constitutions (
        constitution_id, active_doctrine_ids, active_conflict_ids,
        active_judgment_ids, active_override_ids, active_operator_authority_ids,
        constitutional_state, legitimacy_score, governance_coherence_score, last_ratified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(constitution_id) DO UPDATE SET
        active_doctrine_ids=excluded.active_doctrine_ids,
        active_conflict_ids=excluded.active_conflict_ids,
        active_judgment_ids=excluded.active_judgment_ids,
        active_override_ids=excluded.active_override_ids,
        active_operator_authority_ids=excluded.active_operator_authority_ids,
        constitutional_state=excluded.constitutional_state,
        legitimacy_score=excluded.legitimacy_score,
        governance_coherence_score=excluded.governance_coherence_score,
        last_ratified_at=excluded.last_ratified_at
    `);
    this.getConstitutionStmt = db.prepare(`
      SELECT * FROM live_governance_constitutions WHERE constitution_id = ?
    `);

    // Audit events
    this.insertAuditEventStmt = db.prepare(`
      INSERT INTO constitutional_audit_events (
        audit_event_id, constitution_id, event_type, actor_id,
        related_entity_id, summary, evidence_refs, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.getAuditEventsStmt = db.prepare(`
      SELECT * FROM constitutional_audit_events ORDER BY timestamp DESC LIMIT ?
    `);
    this.getAuditEventsByConstitutionStmt = db.prepare(`
      SELECT * FROM constitutional_audit_events
      WHERE constitution_id = ?
      ORDER BY timestamp DESC LIMIT ?
    `);

    // Legitimacy
    this.upsertLegitimacyStmt = db.prepare(`
      INSERT INTO constitutional_legitimacy_records (
        legitimacy_id, constitution_id,
        doctrine_coherence_score, operator_authority_validity_score,
        override_discipline_score, audit_completeness_score,
        live_governance_consistency_score, aggregate_legitimacy_score,
        legitimacy_state, evaluated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(legitimacy_id) DO UPDATE SET
        doctrine_coherence_score=excluded.doctrine_coherence_score,
        operator_authority_validity_score=excluded.operator_authority_validity_score,
        override_discipline_score=excluded.override_discipline_score,
        audit_completeness_score=excluded.audit_completeness_score,
        live_governance_consistency_score=excluded.live_governance_consistency_score,
        aggregate_legitimacy_score=excluded.aggregate_legitimacy_score,
        legitimacy_state=excluded.legitimacy_state,
        evaluated_at=excluded.evaluated_at
    `);
    this.getLegitimacyStmt = db.prepare(`
      SELECT * FROM constitutional_legitimacy_records
      WHERE constitution_id = ?
      ORDER BY evaluated_at DESC LIMIT 1
    `);

    // Sovereign readiness
    this.insertSovereignReadinessStmt = db.prepare(`
      INSERT INTO sovereign_readiness_states (
        closure_id, constitution_id, boundary_state, external_interface_state,
        federation_readiness_state, stress_readiness_state,
        closure_decision, rationale, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.getLatestSovereignReadinessStmt = db.prepare(`
      SELECT * FROM sovereign_readiness_states
      WHERE constitution_id = ?
      ORDER BY decided_at DESC LIMIT 1
    `);

    // Synthesis
    this.insertSynthesisStmt = db.prepare(`
      INSERT INTO governance_synthesis_states (
        closure_id, orchestration_id, orchestration_state,
        legitimacy_synthesis_state, dispute_harmonization_state,
        constitutional_intelligence_state, closure_decision,
        rationale, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.getLatestSynthesisStmt = db.prepare(`
      SELECT * FROM governance_synthesis_states
      ORDER BY decided_at DESC LIMIT 1
    `);

    // Continuity
    this.insertContinuityStmt = db.prepare(`
      INSERT INTO civilizational_continuity_states (
        closure_id, constitution_id, memory_integrity_state,
        drift_state, generational_stability_state, long_cycle_state,
        closure_decision, rationale, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.getLatestContinuityStmt = db.prepare(`
      SELECT * FROM civilizational_continuity_states
      WHERE constitution_id = ?
      ORDER BY decided_at DESC LIMIT 1
    `);
  }

  // ─── Incident Patterns ───

  insertIncidentPattern(row: RuntimeIncidentPatternRow): void {
    this.insertIncidentPatternStmt.run(
      row.pattern_id,
      row.pattern_type,
      row.source_closure_ids,
      row.source_trace_ids,
      row.recurrence_score,
      row.severity_trend,
      row.detected_at,
    );
  }

  getIncidentPattern(patternId: string): RuntimeIncidentPatternRow | undefined {
    return this.getIncidentPatternStmt.get(patternId) as RuntimeIncidentPatternRow | undefined;
  }

  listIncidentPatterns(limit = 20): RuntimeIncidentPatternRow[] {
    return this.listIncidentPatternsStmt.all(limit) as RuntimeIncidentPatternRow[];
  }

  // ─── Doctrines ───

  insertDoctrine(row: OperationalDoctrineRow): void {
    this.insertDoctrineStmt.run(
      row.doctrine_id,
      row.doctrine_type,
      row.supporting_pattern_ids,
      row.supporting_learning_ids,
      row.doctrine_strength,
      row.enforcement_level,
      row.ratified_at,
    );
  }

  getDoctrine(doctrineId: string): OperationalDoctrineRow | undefined {
    return this.getDoctrineStmt.get(doctrineId) as OperationalDoctrineRow | undefined;
  }

  listDoctrines(limit = 20): OperationalDoctrineRow[] {
    return this.listDoctrinesStmt.all(limit) as OperationalDoctrineRow[];
  }

  // ─── Constitution ───

  upsertConstitution(row: LiveGovernanceConstitutionRow): void {
    this.upsertConstitutionStmt.run(
      row.constitution_id,
      row.active_doctrine_ids,
      row.active_conflict_ids,
      row.active_judgment_ids,
      row.active_override_ids,
      row.active_operator_authority_ids,
      row.constitutional_state,
      row.legitimacy_score,
      row.governance_coherence_score,
      row.last_ratified_at,
    );
  }

  getConstitution(constitutionId: string): LiveGovernanceConstitutionRow | undefined {
    return this.getConstitutionStmt.get(constitutionId) as LiveGovernanceConstitutionRow | undefined;
  }

  // ─── Audit Events ───

  insertAuditEvent(row: ConstitutionalAuditEventRow): void {
    this.insertAuditEventStmt.run(
      row.audit_event_id,
      row.constitution_id,
      row.event_type,
      row.actor_id,
      row.related_entity_id,
      row.summary,
      row.evidence_refs,
      row.timestamp,
    );
  }

  getAuditEvents(limit = 50): ConstitutionalAuditEventRow[] {
    return this.getAuditEventsStmt.all(limit) as ConstitutionalAuditEventRow[];
  }

  getAuditEventsByConstitution(
    constitutionId: string,
    limit = 50,
  ): ConstitutionalAuditEventRow[] {
    return this.getAuditEventsByConstitutionStmt.all(
      constitutionId,
      limit,
    ) as ConstitutionalAuditEventRow[];
  }

  // ─── Legitimacy ───

  upsertLegitimacy(row: ConstitutionalLegitimacyRow): void {
    this.upsertLegitimacyStmt.run(
      row.legitimacy_id,
      row.constitution_id,
      row.doctrine_coherence_score,
      row.operator_authority_validity_score,
      row.override_discipline_score,
      row.audit_completeness_score,
      row.live_governance_consistency_score,
      row.aggregate_legitimacy_score,
      row.legitimacy_state,
      row.evaluated_at,
    );
  }

  getLatestLegitimacy(
    constitutionId: string,
  ): ConstitutionalLegitimacyRow | undefined {
    return this.getLegitimacyStmt.get(constitutionId) as ConstitutionalLegitimacyRow | undefined;
  }

  // ─── Sovereign Readiness ───

  insertSovereignReadiness(row: SovereignReadinessRow): void {
    this.insertSovereignReadinessStmt.run(
      row.closure_id,
      row.constitution_id,
      row.boundary_state,
      row.external_interface_state,
      row.federation_readiness_state,
      row.stress_readiness_state,
      row.closure_decision,
      row.rationale,
      row.decided_at,
    );
  }

  getLatestSovereignReadiness(
    constitutionId: string,
  ): SovereignReadinessRow | undefined {
    return this.getLatestSovereignReadinessStmt.get(
      constitutionId,
    ) as SovereignReadinessRow | undefined;
  }

  // ─── Synthesis ───

  insertSynthesis(row: GovernanceSynthesisRow): void {
    this.insertSynthesisStmt.run(
      row.closure_id,
      row.orchestration_id,
      row.orchestration_state,
      row.legitimacy_synthesis_state,
      row.dispute_harmonization_state,
      row.constitutional_intelligence_state,
      row.closure_decision,
      row.rationale,
      row.decided_at,
    );
  }

  getLatestSynthesis(): GovernanceSynthesisRow | undefined {
    return this.getLatestSynthesisStmt.get() as GovernanceSynthesisRow | undefined;
  }

  // ─── Continuity ───

  insertContinuity(row: CivilizationalContinuityRow): void {
    this.insertContinuityStmt.run(
      row.closure_id,
      row.constitution_id,
      row.memory_integrity_state,
      row.drift_state,
      row.generational_stability_state,
      row.long_cycle_state,
      row.closure_decision,
      row.rationale,
      row.decided_at,
    );
  }

  getLatestContinuity(
    constitutionId: string,
  ): CivilizationalContinuityRow | undefined {
    return this.getLatestContinuityStmt.get(
      constitutionId,
    ) as CivilizationalContinuityRow | undefined;
  }
}
