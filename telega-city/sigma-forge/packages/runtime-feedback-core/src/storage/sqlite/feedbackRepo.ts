import type Database from "better-sqlite3";
import type { FeedbackEvent } from "../../runtime-feedback-contracts/src/feedback.js";
import type { SessionFeedbackSummary, RouteFeedbackSummary } from "../../runtime-feedback-contracts/src/summaries.js";

export function createFeedbackEventsRepo(db: Database.Database) {
  return {
    saveEvent(event: FeedbackEvent): void {
      db.prepare(
        `INSERT INTO feedback_events (event_id, session_id, trace_id, user_id, core_user_id, transport, route_id, tool_id, event_type, outcome, severity, reason_code, metadata_json, created_at)
         VALUES (@event_id, @session_id, @trace_id, @user_id, @core_user_id, @transport, @route_id, @tool_id, @event_type, @outcome, @severity, @reason_code, @metadata_json, @created_at)`
      ).run({
        event_id: event.event_id,
        session_id: event.session_id ?? null,
        trace_id: event.trace_id ?? null,
        user_id: event.user_id ?? null,
        core_user_id: event.core_user_id ?? null,
        transport: event.transport ?? null,
        route_id: event.route_id ?? null,
        tool_id: event.tool_id ?? null,
        event_type: event.event_type,
        outcome: event.outcome ?? null,
        severity: event.severity ?? null,
        reason_code: event.reason_code ?? null,
        metadata_json: event.metadata ? JSON.stringify(event.metadata) : null,
        created_at: event.created_at,
      });
    },
    listEvents(filters?: { session_id?: string; route_id?: string }): FeedbackEvent[] {
      let sql = "SELECT * FROM feedback_events WHERE 1=1";
      const params: any[] = [];
      if (filters?.session_id) { sql += " AND session_id = ?"; params.push(filters.session_id); }
      if (filters?.route_id) { sql += " AND route_id = ?"; params.push(filters.route_id); }
      sql += " ORDER BY created_at DESC";
      const rows = db.prepare(sql).all(...params);
      return rows.map((r: any) => ({ ...r, metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined }));
    },
    getEventsBySession(session_id: string): FeedbackEvent[] {
      return this.listEvents({ session_id });
    },
    getEventsByRoute(route_id: string): FeedbackEvent[] {
      return this.listEvents({ route_id });
    },
  };
}

export function createExecutionOutcomesRepo(db: Database.Database) {
  return {
    saveOutcome(outcome: { outcome_id: string; session_id: string; trace_id?: string; route_id?: string; transport?: string; outcome: string; reason_code?: string; duration_ms?: number; created_at: string }): void {
      db.prepare(
        `INSERT INTO execution_outcomes (outcome_id, session_id, trace_id, route_id, transport, outcome, reason_code, duration_ms, created_at)
         VALUES (@outcome_id, @session_id, @trace_id, @route_id, @transport, @outcome, @reason_code, @duration_ms, @created_at)`
      ).run({
        outcome_id: outcome.outcome_id,
        session_id: outcome.session_id,
        trace_id: outcome.trace_id ?? null,
        route_id: outcome.route_id ?? null,
        transport: outcome.transport ?? null,
        outcome: outcome.outcome,
        reason_code: outcome.reason_code ?? null,
        duration_ms: outcome.duration_ms ?? null,
        created_at: outcome.created_at,
      });
    },
  };
}

export function createFeedbackAggregatesRepo(db: Database.Database) {
  return {
    saveAggregate(aggregate: { aggregate_id: string; scope_kind: string; scope_id: string; summary_json: string; computed_at: string }): void {
      db.prepare(
        `INSERT OR REPLACE INTO feedback_aggregates (aggregate_id, scope_kind, scope_id, summary_json, computed_at)
         VALUES (@aggregate_id, @scope_kind, @scope_id, @summary_json, @computed_at)`
      ).run({
        aggregate_id: aggregate.aggregate_id,
        scope_kind: aggregate.scope_kind,
        scope_id: aggregate.scope_id,
        summary_json: aggregate.summary_json,
        computed_at: aggregate.computed_at,
      });
    },
    getAggregate(scope_kind: string, scope_id: string): any {
      const row = db.prepare("SELECT * FROM feedback_aggregates WHERE scope_kind = ? AND scope_id = ?").get(scope_kind, scope_id);
      return row ? { ...row, summary: JSON.parse((row as any).summary_json) } : null;
    },
  };
}

export function buildSessionSummary(events: FeedbackEvent[]): SessionFeedbackSummary {
  const success_count = events.filter((e) => e.outcome === "success").length;
  const failure_count = events.filter((e) => e.outcome === "failure").length;
  const recovered_count = events.filter((e) => e.outcome === "recovered").length;
  const fallback_count = events.filter((e) => e.event_type === "fallback_triggered").length;
  const retry_count = events.filter((e) => e.event_type === "retry_requested").length;
  const severity_breakdown = {
    low: events.filter((e) => e.severity === "low").length,
    medium: events.filter((e) => e.severity === "medium").length,
    high: events.filter((e) => e.severity === "high").length,
  };
  return {
    session_id: events[0]?.session_id ?? "",
    total_events: events.length,
    success_count,
    failure_count,
    recovered_count,
    fallback_count,
    retry_count,
    severity_breakdown,
    last_event_at: events[0]?.created_at,
  };
}

export function buildRouteSummary(events: FeedbackEvent[]): RouteFeedbackSummary {
  const success_count = events.filter((e) => e.outcome === "success").length;
  const failure_count = events.filter((e) => e.outcome === "failure").length;
  const recovered_count = events.filter((e) => e.outcome === "recovered").length;
  const fallback_count = events.filter((e) => e.event_type === "fallback_triggered").length;
  const recovery_attempts = fallback_count + events.filter((e) => e.event_type === "replay_used").length;
  const recovery_success_rate = recovery_attempts > 0 ? recovered_count / recovery_attempts : 0;
  const degradation_count = events.filter((e) => e.event_type === "transport_degraded").length;
  return {
    route_id: events[0]?.route_id ?? "",
    total_events: events.length,
    success_count,
    failure_count,
    recovered_count,
    fallback_count,
    recovery_success_rate,
    degradation_count,
  };
}
