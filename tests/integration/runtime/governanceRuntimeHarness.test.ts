/**
 * Integration Tests for Governance Runtime — X2.5
 *
 * Tests the full pipeline:
 *   incident → pattern → doctrine → constitution update → audit event → read model
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { GovernanceRepos, type SqliteLikeDb } from "../../../src/runtime/repos/governanceRepos.js";
import { GovernanceEventWriter } from "../../../src/runtime/events/governanceEventWriter.js";
import {
  GovernanceService,
  ConstitutionOrchestrator,
  OversightCoordinator,
  GovernanceReadModels,
} from "../../../src/runtime/services/governanceServices.js";

// ============================================================================
// Test database setup
// ============================================================================

function createTestDb(): Database.Database {
  const db = new Database(":memory:");

  // Enable foreign keys
  db.pragma("foreign_keys = ON");

  // Apply schema (inline version of migration)
  db.exec(`
    CREATE TABLE IF NOT EXISTS runtime_incident_patterns (
      pattern_id TEXT PRIMARY KEY,
      pattern_type TEXT NOT NULL,
      source_closure_ids TEXT NOT NULL,
      source_trace_ids TEXT NOT NULL,
      recurrence_score INTEGER NOT NULL,
      severity_trend TEXT NOT NULL,
      detected_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS operational_doctrines (
      doctrine_id TEXT PRIMARY KEY,
      doctrine_type TEXT NOT NULL,
      supporting_pattern_ids TEXT NOT NULL,
      supporting_learning_ids TEXT NOT NULL,
      doctrine_strength INTEGER NOT NULL,
      enforcement_level TEXT NOT NULL,
      ratified_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS live_governance_constitutions (
      constitution_id TEXT PRIMARY KEY,
      active_doctrine_ids TEXT NOT NULL,
      active_conflict_ids TEXT NOT NULL,
      active_judgment_ids TEXT NOT NULL,
      active_override_ids TEXT NOT NULL,
      active_operator_authority_ids TEXT NOT NULL,
      constitutional_state TEXT NOT NULL,
      legitimacy_score INTEGER NOT NULL,
      governance_coherence_score INTEGER NOT NULL,
      last_ratified_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS constitutional_audit_events (
      audit_event_id TEXT PRIMARY KEY,
      constitution_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor_id TEXT,
      related_entity_id TEXT,
      summary TEXT NOT NULL,
      evidence_refs TEXT NOT NULL,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS constitutional_legitimacy_records (
      legitimacy_id TEXT PRIMARY KEY,
      constitution_id TEXT NOT NULL,
      doctrine_coherence_score INTEGER NOT NULL,
      operator_authority_validity_score INTEGER NOT NULL,
      override_discipline_score INTEGER NOT NULL,
      audit_completeness_score INTEGER NOT NULL,
      live_governance_consistency_score INTEGER NOT NULL,
      aggregate_legitimacy_score INTEGER NOT NULL,
      legitimacy_state TEXT NOT NULL,
      evaluated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sovereign_readiness_states (
      closure_id TEXT PRIMARY KEY,
      constitution_id TEXT NOT NULL,
      boundary_state TEXT NOT NULL,
      external_interface_state TEXT NOT NULL,
      federation_readiness_state TEXT NOT NULL,
      stress_readiness_state TEXT NOT NULL,
      closure_decision TEXT NOT NULL,
      rationale TEXT NOT NULL,
      decided_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS civilizational_continuity_states (
      closure_id TEXT PRIMARY KEY,
      constitution_id TEXT NOT NULL,
      memory_integrity_state TEXT NOT NULL,
      drift_state TEXT NOT NULL,
      generational_stability_state TEXT NOT NULL,
      long_cycle_state TEXT NOT NULL,
      closure_decision TEXT NOT NULL,
      rationale TEXT NOT NULL,
      decided_at INTEGER NOT NULL
    );

    -- Seed default constitution
    INSERT OR IGNORE INTO live_governance_constitutions (
      constitution_id, active_doctrine_ids, active_conflict_ids,
      active_judgment_ids, active_override_ids, active_operator_authority_ids,
      constitutional_state, legitimacy_score, governance_coherence_score, last_ratified_at
    ) VALUES (
      'live_governance_constitution_main',
      '[]', '[]', '[]', '[]', '[]',
      'stable', 85, 82, ${Date.now()}
    );
  `);

  return db;
}

function createTestRuntime() {
  const db = createTestDb();
  const repos = new GovernanceRepos(db as unknown as SqliteLikeDb);
  const events = new GovernanceEventWriter({ repos });
  const governanceService = new GovernanceService(repos, events);
  const orchestrator = new ConstitutionOrchestrator(repos, events);
  const oversight = new OversightCoordinator(repos, events);
  const readModels = new GovernanceReadModels(repos);

  return { db, repos, events, governanceService, orchestrator, oversight, readModels };
}

// ============================================================================
// TEST A — Incident processing + audit emission
// ============================================================================

describe("governance runtime — incident processing", () => {
  it("processes incident and emits audit evidence", () => {
    const runtime = createTestRuntime();

    const patternId = runtime.governanceService.processIncident({
      constitutionId: "live_governance_constitution_main",
      traceId: "trace_1",
      patternType: "bridge_timeout_cluster",
      recurrenceScore: 72,
    });

    // Verify pattern was stored
    const row = runtime.db
      .prepare("SELECT * FROM runtime_incident_patterns WHERE pattern_id = ?")
      .get(patternId) as Record<string, unknown> | undefined;

    assert.ok(row);
    assert.equal(row?.pattern_id, patternId);
    assert.equal(row?.pattern_type, "bridge_timeout_cluster");
    assert.equal(row?.recurrence_score, 72);

    // Verify audit event was emitted
    const audit = runtime.db
      .prepare("SELECT * FROM constitutional_audit_events ORDER BY timestamp DESC LIMIT 1")
      .get() as Record<string, unknown> | undefined;

    assert.ok(audit);
    assert.equal(audit?.event_type, "incident_pattern_detected");
    assert.equal(audit?.constitution_id, "live_governance_constitution_main");
    assert.ok(String(audit?.evidence_refs).includes("effect_confirmed"));
  });

  it("ratifies doctrine and emits audit event", () => {
    const runtime = createTestRuntime();

    const doctrineId = runtime.governanceService.ratifyDoctrine({
      constitutionId: "live_governance_constitution_main",
      doctrineType: "fallback_before_failure",
      supportingPatternIds: ["pattern_1"],
      supportingLearningIds: ["learning_1"],
      doctrineStrength: 75,
      enforcementLevel: "strong",
    });

    // Verify doctrine was stored
    const row = runtime.db
      .prepare("SELECT * FROM operational_doctrines WHERE doctrine_id = ?")
      .get(doctrineId) as Record<string, unknown> | undefined;

    assert.ok(row);
    assert.equal(row?.doctrine_type, "fallback_before_failure");
    assert.equal(row?.doctrine_strength, 75);
    assert.equal(row?.enforcement_level, "strong");

    // Verify audit event
    const audit = runtime.db
      .prepare(
        "SELECT * FROM constitutional_audit_events WHERE event_type = 'doctrine_ratified' ORDER BY timestamp DESC LIMIT 1",
      )
      .get() as Record<string, unknown> | undefined;

    assert.ok(audit);
    assert.equal(audit?.event_type, "doctrine_ratified");
  });
});

// ============================================================================
// TEST B — Constitution orchestration
// ============================================================================

describe("governance runtime — constitution orchestration", () => {
  it("updates constitution and emits audit event", () => {
    const runtime = createTestRuntime();

    const constitutionId = runtime.orchestrator.updateConstitution({
      constitutionId: "live_governance_constitution_main",
      doctrineIds: ["doctrine_1", "doctrine_2"],
      conflictIds: [],
      judgmentIds: [],
      overrideIds: [],
      operatorAuthorityIds: [],
      constitutionalState: "guarded",
      legitimacyScore: 80,
      governanceCoherenceScore: 78,
    });

    assert.equal(constitutionId, "live_governance_constitution_main");

    // Verify constitution was updated
    const row = runtime.db
      .prepare("SELECT * FROM live_governance_constitutions WHERE constitution_id = ?")
      .get(constitutionId) as Record<string, unknown> | undefined;

    assert.ok(row);
    assert.equal(row?.constitutional_state, "guarded");
    assert.equal(row?.legitimacy_score, 80);

    const doctrineIds = JSON.parse(String(row?.active_doctrine_ids));
    assert.equal(doctrineIds.length, 2);
    assert.ok(doctrineIds.includes("doctrine_1"));

    // Verify audit event
    const audit = runtime.db
      .prepare(
        "SELECT * FROM constitutional_audit_events WHERE event_type = 'constitution_updated' ORDER BY timestamp DESC LIMIT 1",
      )
      .get() as Record<string, unknown> | undefined;

    assert.ok(audit);
  });

  it("reads constitution health via read model", () => {
    const runtime = createTestRuntime();

    // First update the constitution
    runtime.orchestrator.updateConstitution({
      constitutionId: "live_governance_constitution_main",
      doctrineIds: ["doctrine_1"],
      conflictIds: ["conflict_1"],
      judgmentIds: [],
      overrideIds: ["override_1"],
      operatorAuthorityIds: [],
      constitutionalState: "stable",
      legitimacyScore: 88,
      governanceCoherenceScore: 85,
    });

    // Read via read model
    const health = runtime.readModels.getConstitutionHealth("live_governance_constitution_main");

    assert.ok(health);
    assert.equal(health.constitutionalState, "stable");
    assert.equal(health.legitimacyScore, 88);
    assert.equal(health.activeDoctrineCount, 1);
    assert.equal(health.activeConflictCount, 1);
    assert.equal(health.activeOverrideCount, 1);
  });
});

// ============================================================================
// TEST C — Oversight coordinator
// ============================================================================

describe("governance runtime — oversight coordination", () => {
  it("evaluates system as stable under low risk", () => {
    const runtime = createTestRuntime();

    const result = runtime.oversight.evaluateSystem({
      constitutionId: "live_governance_constitution_main",
      driftScore: 20,
      pressureScore: 15,
      overrideCount: 0,
      conflictCount: 0,
    });

    assert.equal(result, "stable");
  });

  it("evaluates system as watch under medium risk", () => {
    const runtime = createTestRuntime();

    const result = runtime.oversight.evaluateSystem({
      constitutionId: "live_governance_constitution_main",
      driftScore: 50,
      pressureScore: 45,
      overrideCount: 2,
      conflictCount: 1,
    });

    assert.equal(result, "watch");
  });

  it("evaluates system as escalate under high risk", () => {
    const runtime = createTestRuntime();

    const result = runtime.oversight.evaluateSystem({
      constitutionId: "live_governance_constitution_main",
      driftScore: 80,
      pressureScore: 75,
      overrideCount: 6,
      conflictCount: 4,
    });

    assert.equal(result, "escalate");

    // Verify audit event was emitted
    const audit = runtime.db
      .prepare(
        "SELECT * FROM constitutional_audit_events WHERE event_type = 'governance_risk_detected' ORDER BY timestamp DESC LIMIT 1",
      )
      .get() as Record<string, unknown> | undefined;

    assert.ok(audit);
  });

  it("records legitimacy evaluation", () => {
    const runtime = createTestRuntime();

    const legitimacyId = runtime.oversight.recordLegitimacy({
      constitutionId: "live_governance_constitution_main",
      doctrineCoherenceScore: 85,
      operatorAuthorityValidityScore: 90,
      overrideDisciplineScore: 80,
      auditCompletenessScore: 95,
      liveGovernanceConsistencyScore: 88,
    });

    assert.ok(legitimacyId.startsWith("legitimacy_"));

    // Verify legitimacy was stored
    const row = runtime.db
      .prepare("SELECT * FROM constitutional_legitimacy_records WHERE legitimacy_id = ?")
      .get(legitimacyId) as Record<string, unknown> | undefined;

    assert.ok(row);
    assert.equal(row?.aggregate_legitimacy_score, 88); // (85+90+80+95+88)/5 = 87.6 → 88
    assert.equal(row?.legitimacy_state, "legitimate");
  });

  it("records sovereign readiness", () => {
    const runtime = createTestRuntime();

    const closureId = runtime.oversight.recordSovereignReadiness({
      constitutionId: "live_governance_constitution_main",
      boundaryState: "stable",
      externalInterfaceState: "active",
      federationReadinessState: "ready",
      stressReadinessState: "prepared",
      closureDecision: "sovereign_ready",
      rationale: "All checks passed",
    });

    assert.ok(closureId.startsWith("sovereign_"));

    // Verify via read model
    const readiness = runtime.readModels.getSovereignReadiness("live_governance_constitution_main");
    assert.ok(readiness);
    assert.equal(readiness.boundaryState, "stable");
    assert.equal(readiness.closureDecision, "sovereign_ready");
  });

  it("records continuity state", () => {
    const runtime = createTestRuntime();

    const closureId = runtime.oversight.recordContinuity({
      constitutionId: "live_governance_constitution_main",
      memoryIntegrityState: "strong",
      driftState: "stable",
      generationalStabilityState: "safe",
      longCycleState: "stable",
      closureDecision: "civilization_stable",
      rationale: "All continuity checks passed",
    });

    assert.ok(closureId.startsWith("continuity_"));

    // Verify via read model
    const continuity = runtime.readModels.getContinuity("live_governance_constitution_main");
    assert.ok(continuity);
    assert.equal(continuity.memoryIntegrityState, "strong");
    assert.equal(continuity.closureDecision, "civilization_stable");
  });
});

// ============================================================================
// TEST D — Full pipeline: incident → doctrine → constitution → audit → read model
// ============================================================================

describe("governance runtime — full pipeline", () => {
  it("processes incident, ratifies doctrine, updates constitution, and reads health", () => {
    const runtime = createTestRuntime();

    // Step 1: Process incident
    const patternId = runtime.governanceService.processIncident({
      constitutionId: "live_governance_constitution_main",
      traceId: "trace_full_1",
      patternType: "fallback_spike",
      recurrenceScore: 65,
    });

    // Step 2: Ratify doctrine based on pattern
    const doctrineId = runtime.governanceService.ratifyDoctrine({
      constitutionId: "live_governance_constitution_main",
      doctrineType: "strict_secret_guarding",
      supportingPatternIds: [patternId],
      supportingLearningIds: [],
      doctrineStrength: 80,
      enforcementLevel: "mandatory",
    });

    // Step 3: Update constitution to include new doctrine
    runtime.orchestrator.updateConstitution({
      constitutionId: "live_governance_constitution_main",
      doctrineIds: [doctrineId],
      conflictIds: [],
      judgmentIds: [],
      overrideIds: [],
      operatorAuthorityIds: [],
      constitutionalState: "guarded",
      legitimacyScore: 82,
      governanceCoherenceScore: 80,
    });

    // Step 4: Evaluate oversight
    const oversightResult = runtime.oversight.evaluateSystem({
      constitutionId: "live_governance_constitution_main",
      driftScore: 30,
      pressureScore: 25,
      overrideCount: 0,
      conflictCount: 0,
    });

    assert.equal(oversightResult, "stable");

    // Step 5: Read constitution health
    const health = runtime.readModels.getConstitutionHealth("live_governance_constitution_main");
    assert.ok(health);
    assert.equal(health.constitutionalState, "guarded");
    assert.equal(health.legitimacyScore, 82);
    assert.equal(health.activeDoctrineCount, 1);

    // Step 6: Verify audit trail
    const audits = runtime.db
      .prepare("SELECT COUNT(*) as count FROM constitutional_audit_events")
      .get() as { count: number };

    assert.equal(audits.count, 3); // incident + doctrine + constitution
  });
});
