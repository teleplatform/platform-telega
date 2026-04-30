import type Database from "better-sqlite3";
import type {
  ConstitutionalPrinciple,
  DoctrineRecord,
  InstitutionalMemoryRecord,
  GovernancePrecedenceRule,
  ConstitutionalChangeProposal,
  DoctrineConflictRecord,
  ConstitutionalActivationRecord,
  ConstitutionalRollbackRecord,
  ConstitutionalAuditEvent,
} from "../../runtime-constitutional-contracts/src/constitutional.js";

function parseJsonList(row: any, field: string): string[] {
  try { return JSON.parse(row[field] || "[]"); } catch { return []; }
}

export function createConstitutionalRepos(db: Database.Database) {
  return {
    principles: {
      save(p: ConstitutionalPrinciple): void {
        db.prepare(
          `INSERT OR REPLACE INTO constitutional_principles (principle_id, title, description, category, precedence_level, status, created_at, created_by)
           VALUES (@principle_id, @title, @description, @category, @precedence_level, @status, @created_at, @created_by)`
        ).run(p);
      },
      getById(id: string): ConstitutionalPrinciple | null {
        return db.prepare("SELECT * FROM constitutional_principles WHERE principle_id = ?").get(id) as ConstitutionalPrinciple | null;
      },
      getActive(): ConstitutionalPrinciple[] {
        return db.prepare("SELECT * FROM constitutional_principles WHERE status = 'active' ORDER BY precedence_level DESC").all() as ConstitutionalPrinciple[];
      },
    },
    doctrines: {
      save(d: DoctrineRecord): void {
        db.prepare(
          `INSERT OR REPLACE INTO doctrine_registry (doctrine_id, title, doctrine_type, linked_principle_ids_json, linked_artifacts_json, status, created_at, created_by)
           VALUES (@doctrine_id, @title, @doctrine_type, @linked_principle_ids_json, @linked_artifacts_json, @status, @created_at, @created_by)`
        ).run({ ...d, linked_principle_ids_json: JSON.stringify(d.linked_principle_ids), linked_artifacts_json: JSON.stringify(d.linked_artifacts) });
      },
      getById(id: string): DoctrineRecord | null {
        const row = db.prepare("SELECT * FROM doctrine_registry WHERE doctrine_id = ?").get(id) as any;
        return row ? { ...row, linked_principle_ids: parseJsonList(row, "linked_principle_ids_json"), linked_artifacts: parseJsonList(row, "linked_artifacts_json") } : null;
      },
      getActive(): DoctrineRecord[] {
        return db.prepare("SELECT * FROM doctrine_registry WHERE status = 'active'").all().map((r: any) => ({ ...r, linked_principle_ids: parseJsonList(r, "linked_principle_ids_json"), linked_artifacts: parseJsonList(r, "linked_artifacts_json") })) as DoctrineRecord[];
      },
    },
    memory: {
      save(m: InstitutionalMemoryRecord): void {
        db.prepare(
          `INSERT OR REPLACE INTO institutional_memory (memory_id, memory_type, title, summary, linked_principle_ids_json, linked_doctrine_ids_json, source_refs_json, status, created_at, created_by)
           VALUES (@memory_id, @memory_type, @title, @summary, @linked_principle_ids_json, @linked_doctrine_ids_json, @source_refs_json, @status, @created_at, @created_by)`
        ).run({ ...m, linked_principle_ids_json: JSON.stringify(m.linked_principle_ids), linked_doctrine_ids_json: JSON.stringify(m.linked_doctrine_ids), source_refs_json: JSON.stringify(m.source_refs) });
      },
      getById(id: string): InstitutionalMemoryRecord | null {
        const row = db.prepare("SELECT * FROM institutional_memory WHERE memory_id = ?").get(id) as any;
        return row ? { ...row, linked_principle_ids: parseJsonList(row, "linked_principle_ids_json"), linked_doctrine_ids: parseJsonList(row, "linked_doctrine_ids_json"), source_refs: parseJsonList(row, "source_refs_json") } : null;
      },
      getActive(): InstitutionalMemoryRecord[] {
        return db.prepare("SELECT * FROM institutional_memory WHERE status = 'active'").all().map((r: any) => ({ ...r, linked_principle_ids: parseJsonList(r, "linked_principle_ids_json"), linked_doctrine_ids: parseJsonList(r, "linked_doctrine_ids_json"), source_refs: parseJsonList(r, "source_refs_json") })) as InstitutionalMemoryRecord[];
      },
    },
    precedence: {
      save(r: GovernancePrecedenceRule): void {
        db.prepare(
          `INSERT OR REPLACE INTO governance_precedence_rules (rule_id, higher_type, lower_type, description, created_at)
           VALUES (@rule_id, @higher_type, @lower_type, @description, @created_at)`
        ).run(r);
      },
      getAll(): GovernancePrecedenceRule[] {
        return db.prepare("SELECT * FROM governance_precedence_rules").all() as GovernancePrecedenceRule[];
      },
    },
    changes: {
      save(c: ConstitutionalChangeProposal): void {
        db.prepare(
          `INSERT OR REPLACE INTO constitutional_change_proposals (change_id, target_type, target_id, change_type, rationale, evidence_refs_json, status, created_at, created_by)
           VALUES (@change_id, @target_type, @target_id, @change_type, @rationale, @evidence_refs_json, @status, @created_at, @created_by)`
        ).run({ ...c, evidence_refs_json: JSON.stringify(c.evidence_refs) });
      },
      getById(id: string): ConstitutionalChangeProposal | null {
        const row = db.prepare("SELECT * FROM constitutional_change_proposals WHERE change_id = ?").get(id) as any;
        return row ? { ...row, evidence_refs: parseJsonList(row, "evidence_refs_json") } : null;
      },
    },
    conflicts: {
      save(c: DoctrineConflictRecord): void {
        db.prepare(
          `INSERT INTO doctrine_conflicts (conflict_id, entity_a_type, entity_a_id, entity_b_type, entity_b_id, conflict_description, resolution, winner_id, resolved_at, resolved_by)
           VALUES (@conflict_id, @entity_a_type, @entity_a_id, @entity_b_type, @entity_b_id, @conflict_description, @resolution, @winner_id, @resolved_at, @resolved_by)`
        ).run(c);
      },
    },
    activations: {
      save(a: ConstitutionalActivationRecord): void {
        db.prepare(
          `INSERT INTO constitutional_activations (activation_id, entity_type, entity_id, activated_at, activated_by, reason)
           VALUES (@activation_id, @entity_type, @entity_id, @activated_at, @activated_by, @reason)`
        ).run(a);
      },
    },
    rollbacks: {
      save(r: ConstitutionalRollbackRecord): void {
        db.prepare(
          `INSERT INTO constitutional_rollbacks (rollback_id, change_id, entity_type, entity_id, rolled_back_at, rolled_back_by, reason)
           VALUES (@rollback_id, @change_id, @entity_type, @entity_id, @rolled_back_at, @rolled_back_by, @reason)`
        ).run(r);
      },
    },
    audit: {
      append(event: ConstitutionalAuditEvent & { entity_type?: string; entity_id?: string }): void {
        db.prepare(
          `INSERT INTO constitutional_audit (audit_id, entity_type, entity_id, event_type, actor, details_json, timestamp)
           VALUES (@audit_id, @entity_type, @entity_id, @event_type, @actor, @details_json, @timestamp)`
        ).run({
          audit_id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          entity_type: event.entity_type ?? null,
          entity_id: event.entity_id ?? null,
          event_type: event.event_type,
          actor: event.actor,
          details_json: JSON.stringify(event.details),
          timestamp: event.timestamp,
        });
      },
      getTrail(entity_type?: string, entity_id?: string): ConstitutionalAuditEvent[] {
        if (entity_type && entity_id) {
          return db.prepare("SELECT * FROM constitutional_audit WHERE entity_type = ? AND entity_id = ? ORDER BY timestamp").all(entity_type, entity_id) as ConstitutionalAuditEvent[];
        }
        return db.prepare("SELECT * FROM constitutional_audit ORDER BY timestamp").all() as ConstitutionalAuditEvent[];
      },
    },
  };
}

export type ConstitutionalRepos = ReturnType<typeof createConstitutionalRepos>;
