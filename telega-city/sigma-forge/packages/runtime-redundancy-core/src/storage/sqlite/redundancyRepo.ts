import type Database from "better-sqlite3";
import type {
  TransportChannel,
  IdentityContinuityRecord,
  FailoverEvent,
  RecoveryRecord,
  DeliveryEnvelope,
  TransportLossEvent,
  OperationalDegradationState,
  RedundancyAuditEvent,
} from "../../runtime-redundancy-contracts/src/redundancy.js";

function parseJsonList(row: any, field: string): string[] {
  try { return JSON.parse(row[field] || "[]"); } catch { return []; }
}

export function createRedundancyRepos(db: Database.Database) {
  return {
    channels: {
      save(ch: TransportChannel): void {
        db.prepare(
          `INSERT OR REPLACE INTO transport_channels (channel_id, transport, identity_key, status, priority, last_heartbeat_at, last_failure_at, failure_reason, updated_at)
           VALUES (@channel_id, @transport, @identity_key, @status, @priority, @last_heartbeat_at, @last_failure_at, @failure_reason, @updated_at)`
        ).run({
          ...ch,
          last_heartbeat_at: ch.last_heartbeat_at ?? null,
          last_failure_at: ch.last_failure_at ?? null,
          failure_reason: ch.failure_reason ?? null,
        });
      },
      getById(id: string): TransportChannel | null {
        return db.prepare("SELECT * FROM transport_channels WHERE channel_id = ?").get(id) as TransportChannel | null;
      },
      getByTransport(transport: string): TransportChannel | null {
        return db.prepare("SELECT * FROM transport_channels WHERE transport = ?").get(transport) as TransportChannel | null;
      },
      listActive(): TransportChannel[] {
        return db.prepare("SELECT * FROM transport_channels WHERE status != 'unavailable' ORDER BY priority ASC").all() as TransportChannel[];
      },
    },
    identities: {
      save(record: IdentityContinuityRecord): void {
        db.prepare(
          `INSERT OR REPLACE INTO identity_continuity (identity_id, transport_identity_key, transport, canonical_user_id, session_id, bound_at, updated_at)
           VALUES (@identity_id, @transport_identity_key, @transport, @canonical_user_id, @session_id, @bound_at, @updated_at)`
        ).run({
          ...record,
          session_id: record.session_id ?? null,
        });
      },
      getByCanonical(canonical_user_id: string): IdentityContinuityRecord[] {
        return db.prepare("SELECT * FROM identity_continuity WHERE canonical_user_id = ?").all(canonical_user_id) as IdentityContinuityRecord[];
      },
      getByTransportKey(transport_identity_key: string, transport: string): IdentityContinuityRecord | null {
        return db.prepare("SELECT * FROM identity_continuity WHERE transport_identity_key = ? AND transport = ?").get(transport_identity_key, transport) as IdentityContinuityRecord | null;
      },
    },
    failovers: {
      save(event: FailoverEvent): void {
        db.prepare(
          `INSERT OR REPLACE INTO failover_events (failover_id, mission_id, session_id, from_transport, to_transport, reason, status, started_at, completed_at, result)
           VALUES (@failover_id, @mission_id, @session_id, @from_transport, @to_transport, @reason, @status, @started_at, @completed_at, @result)`
        ).run({
          ...event,
          mission_id: event.mission_id ?? null,
          session_id: event.session_id ?? null,
          completed_at: event.completed_at ?? null,
          result: event.result ?? null,
        });
      },
      getById(id: string): FailoverEvent | null {
        return db.prepare("SELECT * FROM failover_events WHERE failover_id = ?").get(id) as FailoverEvent | null;
      },
    },
    recovery: {
      save(record: RecoveryRecord): void {
        db.prepare(
          `INSERT OR REPLACE INTO recovery_records (recovery_id, mission_id, session_id, transport, method, status, started_at, completed_at, result_summary, evidence_refs_json)
           VALUES (@recovery_id, @mission_id, @session_id, @transport, @method, @status, @started_at, @completed_at, @result_summary, @evidence_refs_json)`
        ).run({
          ...record,
          mission_id: record.mission_id ?? null,
          session_id: record.session_id ?? null,
          completed_at: record.completed_at ?? null,
          result_summary: record.result_summary ?? null,
          evidence_refs_json: JSON.stringify(record.evidence_refs),
        });
      },
      getById(id: string): RecoveryRecord | null {
        const row = db.prepare("SELECT * FROM recovery_records WHERE recovery_id = ?").get(id) as any;
        return row ? { ...row, evidence_refs: parseJsonList(row, "evidence_refs_json") } : null;
      },
    },
    deliveries: {
      save(envelope: DeliveryEnvelope): void {
        db.prepare(
          `INSERT OR REPLACE INTO delivery_envelopes (delivery_id, mission_id, target_transport, fallback_transport, payload_ref, payload_summary, status, attempt_count, created_at)
           VALUES (@delivery_id, @mission_id, @target_transport, @fallback_transport, @payload_ref, @payload_summary, @status, @attempt_count, @created_at)`
        ).run({
          ...envelope,
          mission_id: envelope.mission_id ?? null,
          fallback_transport: envelope.fallback_transport ?? null,
        });
      },
    },
    lossEvents: {
      save(event: TransportLossEvent): void {
        db.prepare(
          `INSERT INTO transport_loss_events (event_id, transport, severity, reason, affected_missions_json, detected_at)
           VALUES (@event_id, @transport, @severity, @reason, @affected_missions_json, @detected_at)`
        ).run({
          ...event,
          affected_missions_json: JSON.stringify(event.affected_missions),
        });
      },
    },
    degradation: {
      save(state: OperationalDegradationState): void {
        db.prepare(
          `INSERT OR REPLACE INTO operational_degradation_states (degradation_id, scope, scope_id, active_transport, lost_transports_json, degradation_mode, affected_operations_json, activated_at, reason, status)
           VALUES (@degradation_id, @scope, @scope_id, @active_transport, @lost_transports_json, @degradation_mode, @affected_operations_json, @activated_at, @reason, @status)`
        ).run({
          ...state,
          lost_transports_json: JSON.stringify(state.lost_transports),
          affected_operations_json: JSON.stringify(state.affected_operations),
        });
      },
    },
    audit: {
      append(event: RedundancyAuditEvent): void {
        db.prepare(
          `INSERT INTO redundancy_audit (audit_id, event_type, actor, transport, details_json, timestamp)
           VALUES (@audit_id, @event_type, @actor, @transport, @details_json, @timestamp)`
        ).run({
          audit_id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          event_type: event.event_type,
          actor: event.actor,
          transport: event.transport ?? null,
          details_json: JSON.stringify(event.details),
          timestamp: event.timestamp,
        });
      },
    },
  };
}

export type RedundancyRepos = ReturnType<typeof createRedundancyRepos>;
