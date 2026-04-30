import type { FeedbackEvent, FeedbackOutcome, FeedbackEventType, FeedbackSeverity } from "../../runtime-feedback-contracts/src/feedback.js";
import type { SessionFeedbackSummary, RouteFeedbackSummary } from "../../runtime-feedback-contracts/src/summaries.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";

export interface FeedbackApiDeps {
  eventsRepo: {
    saveEvent: (e: FeedbackEvent) => void;
    getEventsBySession: (session_id: string) => FeedbackEvent[];
    getEventsByRoute: (route_id: string) => FeedbackEvent[];
  };
  outcomesRepo: {
    saveOutcome: (o: any) => void;
  };
  aggregatesRepo: {
    saveAggregate: (a: any) => void;
    getAggregate: (scope_kind: string, scope_id: string) => any;
  };
  buildSessionSummary: (events: FeedbackEvent[]) => SessionFeedbackSummary;
  buildRouteSummary: (events: FeedbackEvent[]) => RouteFeedbackSummary;
}

export function createFeedbackApi(deps: FeedbackApiDeps) {
  return {
    recordFeedbackEvent(input: {
      session_id?: string;
      trace_id?: string;
      user_id?: string;
      transport?: string;
      route_id?: string;
      tool_id?: string;
      event_type: FeedbackEventType;
      outcome?: FeedbackOutcome;
      severity?: FeedbackSeverity;
      reason_code?: string;
      metadata?: Record<string, unknown>;
    }): { event_id: string; recorded: boolean } {
      const event: FeedbackEvent = {
        event_id: `fb_${randomUUID()}`,
        session_id: input.session_id,
        trace_id: input.trace_id,
        user_id: input.user_id,
        transport: input.transport,
        route_id: input.route_id,
        tool_id: input.tool_id,
        event_type: input.event_type,
        outcome: input.outcome,
        severity: input.severity,
        reason_code: input.reason_code,
        metadata: input.metadata,
        created_at: nowIso(),
      };
      deps.eventsRepo.saveEvent(event);
      return { event_id: event.event_id, recorded: true };
    },

    recordExecutionOutcome(input: {
      session_id: string;
      trace_id?: string;
      route_id?: string;
      transport?: string;
      outcome: FeedbackOutcome;
      reason_code?: string;
      duration_ms?: number;
    }): { outcome_id: string; recorded: boolean } {
      const outcome_id = `outcome_${randomUUID()}`;
      deps.outcomesRepo.saveOutcome({
        outcome_id,
        session_id: input.session_id,
        trace_id: input.trace_id,
        route_id: input.route_id,
        transport: input.transport,
        outcome: input.outcome,
        reason_code: input.reason_code,
        duration_ms: input.duration_ms,
        created_at: nowIso(),
      });

      // Also write as feedback event
      this.recordFeedbackEvent({
        session_id: input.session_id,
        trace_id: input.trace_id,
        transport: input.transport,
        route_id: input.route_id,
        event_type: input.outcome === "success" ? "execution_completed" : "execution_failed",
        outcome: input.outcome,
        reason_code: input.reason_code,
      });

      return { outcome_id, recorded: true };
    },

    recordRecoveryOutcome(input: {
      session_id: string;
      trace_id?: string;
      transport?: string;
      route_id?: string;
      recovery_type: "fallback" | "replay" | "failover";
      succeeded: boolean;
      reason_code?: string;
    }): { event_id: string; recorded: boolean } {
      const outcome: FeedbackOutcome = input.succeeded ? "recovered" : "failure";

      // Write the trigger event (fallback_triggered or replay_used)
      if (input.recovery_type === "fallback") {
        this.recordFeedbackEvent({
          session_id: input.session_id,
          trace_id: input.trace_id,
          transport: input.transport,
          route_id: input.route_id,
          event_type: "fallback_triggered",
          outcome,
          reason_code: input.reason_code,
        });
      } else if (input.recovery_type === "replay") {
        this.recordFeedbackEvent({
          session_id: input.session_id,
          trace_id: input.trace_id,
          transport: input.transport,
          route_id: input.route_id,
          event_type: "replay_used",
          outcome,
          reason_code: input.reason_code,
        });
      }

      // Write the recovery result event
      const event_type: FeedbackEventType = input.succeeded ? "recovery_succeeded" : "recovery_failed";
      return this.recordFeedbackEvent({
        session_id: input.session_id,
        trace_id: input.trace_id,
        transport: input.transport,
        route_id: input.route_id,
        event_type,
        outcome,
        reason_code: input.reason_code,
        metadata: { recovery_type: input.recovery_type },
      });
    },

    getSessionFeedbackSummary(session_id: string): SessionFeedbackSummary {
      const events = deps.eventsRepo.getEventsBySession(session_id);
      const summary = deps.buildSessionSummary(events);

      // Cache aggregate
      deps.aggregatesRepo.saveAggregate({
        aggregate_id: `agg_session_${session_id}`,
        scope_kind: "session",
        scope_id: session_id,
        summary_json: JSON.stringify(summary),
        computed_at: nowIso(),
      });

      return summary;
    },

    getRouteFeedbackSummary(route_id: string): RouteFeedbackSummary {
      const events = deps.eventsRepo.getEventsByRoute(route_id);
      const summary = deps.buildRouteSummary(events);

      // Cache aggregate
      deps.aggregatesRepo.saveAggregate({
        aggregate_id: `agg_route_${route_id}`,
        scope_kind: "route",
        scope_id: route_id,
        summary_json: JSON.stringify(summary),
        computed_at: nowIso(),
      });

      return summary;
    },
  };
}

export type FeedbackApi = ReturnType<typeof createFeedbackApi>;
