/**
 * Runtime Diagnostics Routes — X2.8
 *
 * Exposes:
 *   GET /v1/runtime/diagnostics/:constitutionId
 *   GET /v1/runtime/health
 *   GET /v1/runtime/audit/:constitutionId
 */

import type { FastifyInstance } from "fastify";
import type { ConstitutionalAuditEventRow, RuntimeIncidentPatternRow, OperationalDoctrineRow } from "../../runtime/repos/governanceRepos.js";

let _runtimeCache: any = null;
function getRuntime() {
  if (!_runtimeCache) {
    try {
      const { getGovernanceRuntime } = require("../../runtime/bootstrap.js");
      _runtimeCache = getGovernanceRuntime();
    } catch (err: any) {
      console.warn("[runtime-diagnostics] Governance runtime unavailable:", err?.message ?? String(err));
      _runtimeCache = null;
    }
  }
  return _runtimeCache;
}

export async function registerRuntimeDiagnosticsRoutes(app: FastifyInstance) {
  // ─── Health ───

  app.get("/v1/runtime/health", async () => {
    const runtime = getRuntime();
    let constitution: any = null;
    if (runtime) {
      constitution = runtime.orchestrator?.getConstitution("live_governance_constitution_main");
    }
    return {
      ok: !!runtime,
      status: constitution?.constitutional_state ?? (runtime ? "unknown" : "unavailable"),
      constitution_id: "live_governance_constitution_main",
      legitimacy_score: constitution?.legitimacy_score ?? 0,
      coherence_score: constitution?.governance_coherence_score ?? 0,
      timestamp: Date.now(),
    };
  });

  // ─── Diagnostics ───

  app.get<{ Params: { constitutionId: string } }>(
    "/v1/runtime/diagnostics/:constitutionId",
    async (req) => {
      const { constitutionId } = req.params;
      const runtime = getRuntime();

      if (!runtime) {
        return { ok: false, error: "Governance runtime unavailable", constitution_id: constitutionId };
      }

      const health = runtime.readModels.getConstitutionHealth(constitutionId);
      const legitimacy = runtime.repos.getLatestLegitimacy(constitutionId);
      const readiness = runtime.readModels.getSovereignReadiness(constitutionId);
      const continuity = runtime.readModels.getContinuity(constitutionId);

      return {
        ok: true,
        constitution_id: constitutionId,
        health,
        legitimacy,
        sovereign_readiness: readiness,
        continuity,
        timestamp: Date.now(),
      };
    },
  );

  // ─── Audit Events ───

  app.get<{ Params: { constitutionId: string }; Querystring: { limit?: string } }>(
    "/v1/runtime/audit/:constitutionId",
    async (req) => {
      const { constitutionId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const runtime = getRuntime();

      if (!runtime) {
        return { ok: false, error: "Governance runtime unavailable", constitution_id: constitutionId };
      }

      const events = runtime.governanceService.getAuditEvents(constitutionId, limit);

      return {
        ok: true,
        constitution_id: constitutionId,
        events: events.map((e: ConstitutionalAuditEventRow) => ({
          audit_event_id: e.audit_event_id,
          event_type: e.event_type,
          summary: e.summary,
          actor_id: e.actor_id,
          related_entity_id: e.related_entity_id,
          timestamp: e.timestamp,
        })),
        count: events.length,
        timestamp: Date.now(),
      };
    },
  );

  // ─── Incident Patterns ───

  app.get<{ Querystring: { limit?: string } }>(
    "/v1/runtime/incidents",
    async (req) => {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      const runtime = getRuntime();

      if (!runtime) {
        return { ok: false, error: "Governance runtime unavailable" };
      }

      const patterns = runtime.governanceService.getIncidentPatterns(limit);

      return {
        ok: true,
        patterns: patterns.map((p: RuntimeIncidentPatternRow) => ({
          pattern_id: p.pattern_id,
          pattern_type: p.pattern_type,
          recurrence_score: p.recurrence_score,
          severity_trend: p.severity_trend,
          detected_at: p.detected_at,
        })),
        count: patterns.length,
        timestamp: Date.now(),
      };
    },
  );

  // ─── Doctrines ───

  app.get<{ Querystring: { limit?: string } }>(
    "/v1/runtime/doctrines",
    async (req) => {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      const runtime = getRuntime();

      if (!runtime) {
        return { ok: false, error: "Governance runtime unavailable" };
      }

      const doctrines = runtime.governanceService.getDoctrines(limit);

      return {
        ok: true,
        doctrines: doctrines.map((d: OperationalDoctrineRow) => ({
          doctrine_id: d.doctrine_id,
          doctrine_type: d.doctrine_type,
          doctrine_strength: d.doctrine_strength,
          enforcement_level: d.enforcement_level,
          ratified_at: d.ratified_at,
        })),
        count: doctrines.length,
        timestamp: Date.now(),
      };
    },
  );

  // ─── Process Incident (POST) ───

  app.post<{
    Body: {
      constitutionId: string;
      traceId: string;
      patternType: string;
      recurrenceScore: number;
    };
  }>("/v1/runtime/incident", async (req) => {
    const { constitutionId, traceId, patternType, recurrenceScore } = req.body;
    const runtime = getRuntime();

    if (!runtime) {
      return { ok: false, error: "Governance runtime unavailable" };
    }

    const patternId = runtime.governanceService.processIncident({
      constitutionId,
      traceId,
      patternType,
      recurrenceScore,
    });

    return {
      ok: true,
      pattern_id: patternId,
      constitution_id: constitutionId,
      timestamp: Date.now(),
    };
  });

  // ─── Ratify Doctrine (POST) ───

  app.post<{
    Body: {
      constitutionId: string;
      doctrineType: string;
      supportingPatternIds?: string[];
      supportingLearningIds?: string[];
      doctrineStrength?: number;
      enforcementLevel?: "advisory" | "strong" | "mandatory";
    };
  }>("/v1/runtime/doctrine", async (req) => {
    const {
      constitutionId,
      doctrineType,
      supportingPatternIds = [],
      supportingLearningIds = [],
      doctrineStrength = 50,
      enforcementLevel = "advisory",
    } = req.body;
    const runtime = getRuntime();

    if (!runtime) {
      return { ok: false, error: "Governance runtime unavailable" };
    }

    const doctrineId = runtime.governanceService.ratifyDoctrine({
      constitutionId,
      doctrineType,
      supportingPatternIds,
      supportingLearningIds,
      doctrineStrength,
      enforcementLevel,
    });

    return {
      ok: true,
      doctrine_id: doctrineId,
      constitution_id: constitutionId,
      timestamp: Date.now(),
    };
  });

  console.log("[governance-runtime] Runtime diagnostics routes registered");
}
