import type Database from "better-sqlite3";
import type {
  CrisisEvent,
  ContinuityModeState,
  RecoveryAttemptRecord,
  ResilienceAuditEvent,
} from "../../runtime-resilience-contracts/src/resilience.js";

export function createCrisisEventsRepo(db: Database.Database) {
  return {
    saveCrisisEvent(event: CrisisEvent): void {
      db.prepare(
        `INSERT OR REPLACE INTO crisis_events (crisis_id, crisis_type, severity, affected_scope, affected_ids_json, detected_at, detected_by, status)
         VALUES (@crisis_id, @crisis_type, @severity, @affected_scope, @affected_ids_json, @detected_at, @detected_by, @status)`
      ).run({
        ...event,
        affected_ids_json: JSON.stringify(event.affected_ids),
      });
    },
    getCrisisEvent(id: string): CrisisEvent | null {
      const row = db.prepare("SELECT * FROM crisis_events WHERE crisis_id = ?").get(id);
      return row ? { ...(row as any), affected_ids: JSON.parse((row as any).affected_ids_json) } : null;
    },
    getOpenCrises(): CrisisEvent[] {
      return db.prepare("SELECT * FROM crisis_events WHERE status IN ('open', 'contained')").all().map((r: any) => ({ ...r, affected_ids: JSON.parse(r.affected_ids_json) }));
    },
  };
}

export function createContinuityModesRepo(db: Database.Database) {
  return {
    setMode(state: ContinuityModeState): void {
      db.prepare(
        `INSERT OR REPLACE INTO continuity_modes (scope_type, scope_id, current_mode, activated_at, activated_by, reason)
         VALUES (@scope_type, @scope_id, @current_mode, @activated_at, @activated_by, @reason)`
      ).run(state);
    },
    getMode(scope_type: string, scope_id: string): ContinuityModeState | null {
      return db.prepare("SELECT * FROM continuity_modes WHERE scope_type = ? AND scope_id = ?").get(scope_type, scope_id) as ContinuityModeState | null;
    },
  };
}

export function createRecoveryAttemptsRepo(db: Database.Database) {
  return {
    saveRecovery(record: RecoveryAttemptRecord): void {
      db.prepare(
        `INSERT INTO recovery_attempts (recovery_id, crisis_id, scope_type, scope_id, started_at, status, rollback_reason)
         VALUES (@recovery_id, @crisis_id, @scope_type, @scope_id, @started_at, @status, @rollback_reason)`
      ).run({
        recovery_id: record.recovery_id,
        crisis_id: record.crisis_id,
        scope_type: record.scope_type,
        scope_id: record.scope_id,
        started_at: record.started_at,
        status: record.status,
        rollback_reason: record.rollback_reason ?? null,
      });
    },
    getRecoveryByCrisis(crisis_id: string): RecoveryAttemptRecord | null {
      return db.prepare("SELECT * FROM recovery_attempts WHERE crisis_id = ? ORDER BY started_at DESC LIMIT 1").get(crisis_id) as RecoveryAttemptRecord | null;
    },
  };
}

export function createResilienceAuditRepo(db: Database.Database) {
  return {
    appendAudit(event: ResilienceAuditEvent & { crisis_id?: string }): void {
      db.prepare(
        `INSERT INTO resilience_audit (audit_id, crisis_id, event_type, actor, details_json, timestamp)
         VALUES (@audit_id, @crisis_id, @event_type, @actor, @details_json, @timestamp)`
      ).run({
        audit_id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        crisis_id: event.crisis_id ?? null,
        event_type: event.event_type,
        actor: event.actor,
        details_json: JSON.stringify(event.details),
        timestamp: event.timestamp,
      });
    },
    getAuditTrail(crisis_id?: string): ResilienceAuditEvent[] {
      if (crisis_id) {
        return db.prepare("SELECT * FROM resilience_audit WHERE crisis_id = ? ORDER BY timestamp").all(crisis_id) as ResilienceAuditEvent[];
      }
      return db.prepare("SELECT * FROM resilience_audit ORDER BY timestamp").all() as ResilienceAuditEvent[];
    },
  };
}
