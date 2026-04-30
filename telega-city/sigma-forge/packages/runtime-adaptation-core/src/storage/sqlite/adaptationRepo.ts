import type Database from "better-sqlite3";
import type {
  AdaptationProposal,
  ProposalEvidenceRef,
  PolicyDecision,
  ReviewDecision,
  AppliedChangeRecord,
  RollbackRecord,
} from "../../runtime-adaptation-contracts/src/adaptation.js";

export function createProposalsRepo(db: Database.Database) {
  return {
    saveProposal(proposal: AdaptationProposal): void {
      db.prepare(
        `INSERT OR REPLACE INTO adaptation_proposals (proposal_id, proposal_type, target_type, target_id, title, rationale, evidence_refs_json, risk_class, proposed_change_json, status, policy_outcome, created_at, created_by)
         VALUES (@proposal_id, @proposal_type, @target_type, @target_id, @title, @rationale, @evidence_refs_json, @risk_class, @proposed_change_json, @status, @policy_outcome, @created_at, @created_by)`
      ).run({
        proposal_id: proposal.proposal_id,
        proposal_type: proposal.proposal_type,
        target_type: proposal.target_type,
        target_id: proposal.target_id,
        title: proposal.title,
        rationale: proposal.rationale,
        evidence_refs_json: JSON.stringify(proposal.evidence_refs),
        risk_class: proposal.risk_class,
        proposed_change_json: JSON.stringify(proposal.proposed_change),
        status: proposal.status,
        policy_outcome: proposal.policy_outcome ?? null,
        created_at: proposal.created_at,
        created_by: proposal.created_by,
      });
    },
    getProposal(proposal_id: string): AdaptationProposal | null {
      const row = db.prepare("SELECT * FROM adaptation_proposals WHERE proposal_id = ?").get(proposal_id);
      if (!row) return null;
      const r = row as any;
      return { ...r, evidence_refs: JSON.parse(r.evidence_refs_json), proposed_change: JSON.parse(r.proposed_change_json) };
    },
    listProposals(filters?: { target_type?: string; status?: string }): AdaptationProposal[] {
      let sql = "SELECT * FROM adaptation_proposals WHERE 1=1";
      const params: any[] = [];
      if (filters?.target_type) { sql += " AND target_type = ?"; params.push(filters.target_type); }
      if (filters?.status) { sql += " AND status = ?"; params.push(filters.status); }
      sql += " ORDER BY created_at DESC";
      const rows = db.prepare(sql).all(...params);
      return rows.map((r: any) => ({ ...r, evidence_refs: JSON.parse(r.evidence_refs_json), proposed_change: JSON.parse(r.proposed_change_json) }));
    },
  };
}

export function createEvidenceRepo(db: Database.Database) {
  return {
    saveEvidence(evidence: ProposalEvidenceRef): void {
      db.prepare(
        `INSERT INTO adaptation_proposal_evidence (ref_id, proposal_id, evidence_type, evidence_id, summary, created_at)
         VALUES (@ref_id, @proposal_id, @evidence_type, @evidence_id, @summary, @created_at)`
      ).run({
        ref_id: evidence.ref_id,
        proposal_id: evidence.proposal_id,
        evidence_type: evidence.evidence_type,
        evidence_id: evidence.evidence_id,
        summary: evidence.summary,
        created_at: evidence.created_at,
      });
    },
    getEvidenceByProposal(proposal_id: string): ProposalEvidenceRef[] {
      const rows = db.prepare("SELECT * FROM adaptation_proposal_evidence WHERE proposal_id = ?").all(proposal_id);
      return rows as ProposalEvidenceRef[];
    },
  };
}

export function createReviewsRepo(db: Database.Database) {
  return {
    saveReview(review: ReviewDecision): void {
      db.prepare(
        `INSERT INTO adaptation_reviews (review_id, proposal_id, action, reviewer_id, notes, created_at)
         VALUES (@review_id, @proposal_id, @action, @reviewer_id, @notes, @created_at)`
      ).run({
        review_id: review.review_id,
        proposal_id: review.proposal_id,
        action: review.action,
        reviewer_id: review.reviewer_id,
        notes: review.notes,
        created_at: review.created_at,
      });
    },
    getReviewsByProposal(proposal_id: string): ReviewDecision[] {
      return db.prepare("SELECT * FROM adaptation_reviews WHERE proposal_id = ?").all(proposal_id) as ReviewDecision[];
    },
  };
}

export function createChangesRepo(db: Database.Database) {
  return {
    saveChange(change: AppliedChangeRecord): void {
      db.prepare(
        `INSERT INTO adaptation_changes (change_id, proposal_id, applied_by, before_snapshot_json, after_snapshot_json, applied_at)
         VALUES (@change_id, @proposal_id, @applied_by, @before_snapshot_json, @after_snapshot_json, @applied_at)`
      ).run({
        change_id: change.change_id,
        proposal_id: change.proposal_id,
        applied_by: change.applied_by,
        before_snapshot_json: JSON.stringify(change.before_snapshot),
        after_snapshot_json: JSON.stringify(change.after_snapshot),
        applied_at: change.applied_at,
      });
    },
    getChangeByProposal(proposal_id: string): AppliedChangeRecord | null {
      const row = db.prepare("SELECT * FROM adaptation_changes WHERE proposal_id = ?").get(proposal_id);
      if (!row) return null;
      const r = row as any;
      return { ...r, before_snapshot: JSON.parse(r.before_snapshot_json), after_snapshot: JSON.parse(r.after_snapshot_json) };
    },
  };
}

export function createRollbacksRepo(db: Database.Database) {
  return {
    saveRollback(rollback: RollbackRecord): void {
      db.prepare(
        `INSERT INTO adaptation_rollbacks (rollback_id, change_id, proposal_id, rolled_back_by, reason, rolled_back_at)
         VALUES (@rollback_id, @change_id, @proposal_id, @rolled_back_by, @reason, @rolled_back_at)`
      ).run({
        rollback_id: rollback.rollback_id,
        change_id: rollback.change_id,
        proposal_id: rollback.proposal_id,
        rolled_back_by: rollback.rolled_back_by,
        reason: rollback.reason,
        rolled_back_at: rollback.rolled_back_at,
      });
    },
    getRollbackByChange(change_id: string): RollbackRecord | null {
      const row = db.prepare("SELECT * FROM adaptation_rollbacks WHERE change_id = ?").get(change_id);
      return row as RollbackRecord | null;
    },
  };
}
