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
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";
import type { ConstitutionalRepos } from "../storage/sqlite/constitutionalRepo.js";

export interface ConstitutionalDeps {
  repos: ConstitutionalRepos;
}

export function createConstitutionalApi(deps: ConstitutionalDeps) {
  const { repos } = deps;

  return {
    createConstitutionalPrinciple(input: {
      title: string;
      description: string;
      category: ConstitutionalPrinciple["category"];
      precedence_level: number;
      created_by: string;
    }): ConstitutionalPrinciple {
      const principle: ConstitutionalPrinciple = {
        principle_id: `principle_${randomUUID()}`,
        title: input.title,
        description: input.description,
        category: input.category,
        precedence_level: input.precedence_level,
        status: "active",
        created_at: nowIso(),
        created_by: input.created_by,
      };
      repos.principles.save(principle);
      repos.audit.append({
        entity_type: "principle",
        entity_id: principle.principle_id,
        event_type: "principle_created",
        actor: input.created_by,
        details: { title: principle.title, category: principle.category, precedence_level: principle.precedence_level },
        timestamp: nowIso(),
      });
      return principle;
    },

    registerDoctrineRecord(input: {
      title: string;
      doctrine_type: DoctrineRecord["doctrine_type"];
      linked_principle_ids: string[];
      linked_artifacts: string[];
      created_by: string;
    }): { doctrine: DoctrineRecord; error?: string } {
      if (input.linked_principle_ids.length === 0 && input.linked_artifacts.length === 0) {
        return { doctrine: {} as DoctrineRecord, error: "Doctrine requires at least one linked principle or artifact" };
      }
      const doctrine: DoctrineRecord = {
        doctrine_id: `doctrine_${randomUUID()}`,
        title: input.title,
        doctrine_type: input.doctrine_type,
        linked_principle_ids: input.linked_principle_ids,
        linked_artifacts: input.linked_artifacts,
        status: "active",
        created_at: nowIso(),
        created_by: input.created_by,
      };
      repos.doctrines.save(doctrine);
      repos.audit.append({
        entity_type: "doctrine",
        entity_id: doctrine.doctrine_id,
        event_type: "doctrine_registered",
        actor: input.created_by,
        details: { title: doctrine.title, doctrine_type: doctrine.doctrine_type, linked_principles: doctrine.linked_principle_ids.length },
        timestamp: nowIso(),
      });
      return { doctrine };
    },

    recordInstitutionalMemory(input: {
      memory_type: InstitutionalMemoryRecord["memory_type"];
      title: string;
      summary: string;
      linked_principle_ids: string[];
      linked_doctrine_ids: string[];
      source_refs: string[];
      created_by: string;
    }): { memory: InstitutionalMemoryRecord; error?: string } {
      if (input.linked_principle_ids.length === 0 && input.linked_doctrine_ids.length === 0) {
        return { memory: {} as InstitutionalMemoryRecord, error: "Institutional memory requires at least one linked principle or doctrine" };
      }
      const memory: InstitutionalMemoryRecord = {
        memory_id: `memory_${randomUUID()}`,
        memory_type: input.memory_type,
        title: input.title,
        summary: input.summary,
        linked_principle_ids: input.linked_principle_ids,
        linked_doctrine_ids: input.linked_doctrine_ids,
        source_refs: input.source_refs,
        status: "active",
        created_at: nowIso(),
        created_by: input.created_by,
      };
      repos.memory.save(memory);
      repos.audit.append({
        entity_type: "memory",
        entity_id: memory.memory_id,
        event_type: "memory_recorded",
        actor: input.created_by,
        details: { memory_type: memory.memory_type, title: memory.title },
        timestamp: nowIso(),
      });
      return { memory };
    },

    evaluateGovernanceConflict(input: {
      entity_a_type: string;
      entity_a_id: string;
      entity_b_type: string;
      entity_b_id: string;
      conflict_description: string;
      resolved_by: string;
    }): DoctrineConflictRecord {
      const rules = repos.precedence.getAll();
      const higherRule = rules.find((r) => r.higher_type === input.entity_a_type && r.lower_type === input.entity_b_type);
      const lowerRule = rules.find((r) => r.higher_type === input.entity_b_type && r.lower_type === input.entity_a_type);

      let resolution: DoctrineConflictRecord["resolution"] = "higher_precedence_wins";
      let winner_id = input.entity_a_id;

      if (lowerRule) {
        resolution = "lower_rule_rejected";
        winner_id = input.entity_b_id;
      }

      const conflict: DoctrineConflictRecord = {
        conflict_id: `conflict_${randomUUID()}`,
        entity_a_type: input.entity_a_type,
        entity_a_id: input.entity_a_id,
        entity_b_type: input.entity_b_type,
        entity_b_id: input.entity_b_id,
        conflict_description: input.conflict_description,
        resolution,
        winner_id,
        resolved_at: nowIso(),
        resolved_by: input.resolved_by,
      };
      repos.conflicts.save(conflict);
      repos.audit.append({
        entity_type: "conflict",
        entity_id: conflict.conflict_id,
        event_type: "governance_conflict_resolved",
        actor: input.resolved_by,
        details: { resolution: conflict.resolution, winner_id: conflict.winner_id },
        timestamp: nowIso(),
      });
      return conflict;
    },

    resolveGovernancePrecedence(input: {
      higher_type: string;
      lower_type: string;
      description: string;
    }): GovernancePrecedenceRule {
      const rule: GovernancePrecedenceRule = {
        rule_id: `precedence_${randomUUID()}`,
        higher_type: input.higher_type,
        lower_type: input.lower_type,
        description: input.description,
        created_at: nowIso(),
      };
      repos.precedence.save(rule);
      return rule;
    },

    proposeConstitutionalChange(input: {
      target_type: ConstitutionalChangeProposal["target_type"];
      target_id?: string;
      change_type: ConstitutionalChangeProposal["change_type"];
      rationale: string;
      evidence_refs: string[];
      created_by: string;
    }): { proposal: ConstitutionalChangeProposal; error?: string } {
      if (!input.rationale || input.rationale.trim().length === 0) {
        return { proposal: {} as ConstitutionalChangeProposal, error: "Constitutional change requires rationale" };
      }
      if (input.evidence_refs.length === 0) {
        return { proposal: {} as ConstitutionalChangeProposal, error: "Constitutional change requires evidence references" };
      }
      const proposal: ConstitutionalChangeProposal = {
        change_id: `change_${randomUUID()}`,
        target_type: input.target_type,
        target_id: input.target_id,
        change_type: input.change_type,
        rationale: input.rationale,
        evidence_refs: input.evidence_refs,
        status: "pending_review",
        created_at: nowIso(),
        created_by: input.created_by,
      };
      repos.changes.save(proposal);
      repos.audit.append({
        entity_type: "change",
        entity_id: proposal.change_id,
        event_type: "constitutional_change_proposed",
        actor: input.created_by,
        details: { target_type: proposal.target_type, change_type: proposal.change_type },
        timestamp: nowIso(),
      });
      return { proposal };
    },

    approveConstitutionalChange(change_id: string, approved_by: string): { approved: boolean; error?: string } {
      const proposal = repos.changes.getById(change_id);
      if (!proposal) return { approved: false, error: "Change proposal not found" };
      if (proposal.status !== "pending_review") return { approved: false, error: `Proposal status is ${proposal.status}` };
      repos.changes.save({ ...proposal, status: "approved" });
      repos.audit.append({
        entity_type: "change",
        entity_id: change_id,
        event_type: "constitutional_change_approved",
        actor: approved_by,
        details: { target_type: proposal.target_type },
        timestamp: nowIso(),
      });
      return { approved: true };
    },

    applyConstitutionalChange(change_id: string, applied_by: string): { applied: boolean; error?: string } {
      const proposal = repos.changes.getById(change_id);
      if (!proposal) return { applied: false, error: "Change proposal not found" };
      if (proposal.status !== "approved") return { applied: false, error: `Proposal status is ${proposal.status}, not approved` };

      // Apply the change based on target type
      if (proposal.target_type === "principle" && proposal.target_id) {
        const principle = repos.principles.getById(proposal.target_id);
        if (principle) {
          const newStatus = proposal.change_type === "revoke" ? "revoked" : proposal.change_type === "supersede" ? "superseded" : principle.status;
          repos.principles.save({ ...principle, status: newStatus });
        }
      } else if (proposal.target_type === "doctrine" && proposal.target_id) {
        const doctrine = repos.doctrines.getById(proposal.target_id);
        if (doctrine) {
          const newStatus = proposal.change_type === "revoke" ? "archived" : proposal.change_type === "supersede" ? "superseded" : doctrine.status;
          repos.doctrines.save({ ...doctrine, status: newStatus });
        }
      }

      repos.changes.save({ ...proposal, status: "applied" });
      repos.audit.append({
        entity_type: "change",
        entity_id: change_id,
        event_type: "constitutional_change_applied",
        actor: applied_by,
        details: { target_type: proposal.target_type, change_type: proposal.change_type },
        timestamp: nowIso(),
      });
      return { applied: true };
    },

    rollbackConstitutionalChange(change_id: string, rolled_back_by: string, reason: string): { rolled_back: boolean; error?: string } {
      const proposal = repos.changes.getById(change_id);
      if (!proposal) return { rolled_back: false, error: "Change proposal not found" };
      if (proposal.status !== "applied") return { rolled_back: false, error: `Proposal status is ${proposal.status}, not applied` };

      // Restore previous state
      if (proposal.target_type === "principle" && proposal.target_id) {
        const principle = repos.principles.getById(proposal.target_id);
        if (principle) {
          repos.principles.save({ ...principle, status: "active" });
        }
      } else if (proposal.target_type === "doctrine" && proposal.target_id) {
        const doctrine = repos.doctrines.getById(proposal.target_id);
        if (doctrine) {
          repos.doctrines.save({ ...doctrine, status: "active" });
        }
      }

      const rollback: ConstitutionalRollbackRecord = {
        rollback_id: `rollback_${randomUUID()}`,
        change_id,
        entity_type: proposal.target_type,
        entity_id: proposal.target_id ?? "",
        rolled_back_at: nowIso(),
        rolled_back_by,
        reason,
      };
      repos.rollbacks.save(rollback);
      repos.changes.save({ ...proposal, status: "rolled_back" });
      repos.audit.append({
        entity_type: "change",
        entity_id: change_id,
        event_type: "constitutional_change_rolled_back",
        actor: rolled_back_by,
        details: { reason },
        timestamp: nowIso(),
      });
      return { rolled_back: true };
    },

    getConstitutionalAuditTrail(entity_type?: string, entity_id?: string): ConstitutionalAuditEvent[] {
      return repos.audit.getTrail(entity_type, entity_id);
    },
  };
}

export type ConstitutionalApi = ReturnType<typeof createConstitutionalApi>;
