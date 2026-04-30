import type {
  AdaptationProposal,
  ProposalEvidenceRef,
  PolicyDecision,
  ReviewDecision,
  AppliedChangeRecord,
  RollbackRecord,
  ProposalAuditTrail,
  PolicyOutcome,
  ReviewAction,
} from "../../runtime-adaptation-contracts/src/adaptation.js";
import { randomUUID } from "crypto";
import { nowIso } from "../utils/now.js";
import { evaluateProposalPolicy } from "../policy/adaptationPolicy.js";

export interface AdaptationDeps {
  proposalsRepo: {
    saveProposal: (p: AdaptationProposal) => void;
    getProposal: (id: string) => AdaptationProposal | null;
    listProposals: (filters?: any) => AdaptationProposal[];
  };
  evidenceRepo: {
    saveEvidence: (e: ProposalEvidenceRef) => void;
    getEvidenceByProposal: (id: string) => ProposalEvidenceRef[];
  };
  reviewsRepo: {
    saveReview: (r: ReviewDecision) => void;
    getReviewsByProposal: (id: string) => ReviewDecision[];
  };
  changesRepo: {
    saveChange: (c: AppliedChangeRecord) => void;
    getChangeByProposal: (id: string) => AppliedChangeRecord | null;
  };
  rollbacksRepo: {
    saveRollback: (r: RollbackRecord) => void;
    getRollbackByChange: (id: string) => RollbackRecord | null;
  };
}

export function createAdaptationApi(deps: AdaptationDeps) {
  return {
    createAdaptationProposal(input: {
      proposal_type: AdaptationProposal["proposal_type"];
      target_type: AdaptationProposal["target_type"];
      target_id: string;
      title: string;
      rationale: string;
      evidence_refs: string[];
      risk_class: AdaptationProposal["risk_class"];
      proposed_change: Record<string, unknown>;
      created_by: string;
    }): { proposal: AdaptationProposal; policy: PolicyDecision } {
      if (input.evidence_refs.length === 0) {
        throw new Error("Proposal requires at least one evidence reference");
      }

      const proposal_id = `prop_${randomUUID()}`;
      const policyResult = evaluateProposalPolicy({ ...input, proposal_id, status: "draft", created_at: nowIso() } as AdaptationProposal);

      const proposal: AdaptationProposal = {
        proposal_id,
        proposal_type: input.proposal_type,
        target_type: input.target_type,
        target_id: input.target_id,
        title: input.title,
        rationale: input.rationale,
        evidence_refs: input.evidence_refs,
        risk_class: input.risk_class,
        proposed_change: input.proposed_change,
        status: policyResult.outcome === "auto_apply_allowed" ? "approved" : "pending_review",
        policy_outcome: policyResult.outcome,
        created_at: nowIso(),
        created_by: input.created_by,
      };

      deps.proposalsRepo.saveProposal(proposal);

      // Save evidence refs
      for (const ref of input.evidence_refs) {
        deps.evidenceRepo.saveEvidence({
          ref_id: `evref_${randomUUID()}`,
          proposal_id,
          evidence_type: "feedback_event",
          evidence_id: ref,
          summary: `Evidence reference: ${ref}`,
          created_at: nowIso(),
        });
      }

      return {
        proposal,
        policy: {
          proposal_id,
          outcome: policyResult.outcome,
          risk_class: policyResult.risk_class,
          reasons: policyResult.reasons,
          evaluated_at: nowIso(),
        },
      };
    },

    submitProposalForReview(proposal_id: string, reviewer_id: string): { submitted: boolean; error?: string } {
      const proposal = deps.proposalsRepo.getProposal(proposal_id);
      if (!proposal) return { submitted: false, error: "Proposal not found" };
      if (proposal.status !== "pending_review") return { submitted: false, error: `Proposal status is ${proposal.status}, not pending_review` };
      if (proposal.risk_class === "forbidden") return { submitted: false, error: "Forbidden proposals cannot be reviewed" };

      deps.proposalsRepo.saveProposal({ ...proposal, status: "pending_review" });
      return { submitted: true };
    },

    approveProposal(proposal_id: string, reviewer_id: string, notes: string): { approved: boolean; error?: string } {
      const proposal = deps.proposalsRepo.getProposal(proposal_id);
      if (!proposal) return { approved: false, error: "Proposal not found" };
      if (proposal.status !== "pending_review") return { approved: false, error: `Proposal status is ${proposal.status}` };
      if (proposal.risk_class === "forbidden") return { approved: false, error: "Forbidden proposals cannot be approved" };

      const review: ReviewDecision = {
        review_id: `review_${randomUUID()}`,
        proposal_id,
        action: "approve",
        reviewer_id,
        notes,
        created_at: nowIso(),
      };
      deps.reviewsRepo.saveReview(review);
      deps.proposalsRepo.saveProposal({ ...proposal, status: "approved" });

      return { approved: true };
    },

    rejectProposal(proposal_id: string, reviewer_id: string, notes: string): { rejected: boolean; error?: string } {
      const proposal = deps.proposalsRepo.getProposal(proposal_id);
      if (!proposal) return { rejected: false, error: "Proposal not found" };

      const review: ReviewDecision = {
        review_id: `review_${randomUUID()}`,
        proposal_id,
        action: "reject",
        reviewer_id,
        notes,
        created_at: nowIso(),
      };
      deps.reviewsRepo.saveReview(review);
      deps.proposalsRepo.saveProposal({ ...proposal, status: "rejected" });

      return { rejected: true };
    },

    deferProposal(proposal_id: string, reviewer_id: string, notes: string): { deferred: boolean; error?: string } {
      const proposal = deps.proposalsRepo.getProposal(proposal_id);
      if (!proposal) return { deferred: false, error: "Proposal not found" };

      const review: ReviewDecision = {
        review_id: `review_${randomUUID()}`,
        proposal_id,
        action: "defer",
        reviewer_id,
        notes,
        created_at: nowIso(),
      };
      deps.reviewsRepo.saveReview(review);
      deps.proposalsRepo.saveProposal({ ...proposal, status: "deferred" });

      return { deferred: true };
    },

    applyApprovedChange(proposal_id: string, applied_by: string): { applied: boolean; change?: AppliedChangeRecord; error?: string } {
      const proposal = deps.proposalsRepo.getProposal(proposal_id);
      if (!proposal) return { applied: false, error: "Proposal not found" };
      if (proposal.status !== "approved") return { applied: false, error: `Proposal status is ${proposal.status}, not approved` };
      if (proposal.policy_outcome === "forbidden") return { applied: false, error: "Forbidden proposals cannot be applied" };

      const beforeSnapshot = { status: "before", target_id: proposal.target_id, target_type: proposal.target_type };
      const afterSnapshot = { status: "after", target_id: proposal.target_id, target_type: proposal.target_type, change: proposal.proposed_change };

      const change: AppliedChangeRecord = {
        change_id: `change_${randomUUID()}`,
        proposal_id,
        applied_by,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
        applied_at: nowIso(),
      };
      deps.changesRepo.saveChange(change);
      deps.proposalsRepo.saveProposal({ ...proposal, status: "applied" });

      return { applied: true, change };
    },

    rollbackAppliedChange(proposal_id: string, rolled_back_by: string, reason: string): { rolled_back: boolean; rollback?: RollbackRecord; error?: string } {
      const proposal = deps.proposalsRepo.getProposal(proposal_id);
      if (!proposal) return { rolled_back: false, error: "Proposal not found" };
      if (proposal.status !== "applied") return { rolled_back: false, error: `Proposal status is ${proposal.status}, not applied` };

      const change = deps.changesRepo.getChangeByProposal(proposal_id);
      if (!change) return { rolled_back: false, error: "No applied change found for proposal" };

      const rollback: RollbackRecord = {
        rollback_id: `rollback_${randomUUID()}`,
        change_id: change.change_id,
        proposal_id,
        rolled_back_by,
        reason,
        rolled_back_at: nowIso(),
      };
      deps.rollbacksRepo.saveRollback(rollback);
      deps.proposalsRepo.saveProposal({ ...proposal, status: "rolled_back" });

      return { rolled_back: true, rollback };
    },

    getProposalAuditTrail(proposal_id: string): ProposalAuditTrail {
      const proposal = deps.proposalsRepo.getProposal(proposal_id);
      const evidence = deps.evidenceRepo.getEvidenceByProposal(proposal_id);
      const reviews = deps.reviewsRepo.getReviewsByProposal(proposal_id);
      const change = deps.changesRepo.getChangeByProposal(proposal_id);
      const rollback = change ? deps.rollbacksRepo.getRollbackByChange(change.change_id) : null;

      const events: ProposalAuditTrail["events"] = [];

      if (proposal) {
        events.push({ event_type: "proposal_created", actor: proposal.created_by, details: { proposal_type: proposal.proposal_type, risk_class: proposal.risk_class }, timestamp: proposal.created_at });
      }
      for (const ev of evidence) {
        events.push({ event_type: "evidence_attached", actor: "system", details: { evidence_type: ev.evidence_type, evidence_id: ev.evidence_id }, timestamp: ev.created_at });
      }
      for (const review of reviews) {
        events.push({ event_type: `review_${review.action}`, actor: review.reviewer_id, details: { notes: review.notes }, timestamp: review.created_at });
      }
      if (change) {
        events.push({ event_type: "change_applied", actor: change.applied_by, details: { change_id: change.change_id }, timestamp: change.applied_at });
      }
      if (rollback) {
        events.push({ event_type: "change_rolled_back", actor: rollback.rolled_back_by, details: { reason: rollback.reason }, timestamp: rollback.rolled_back_at });
      }

      return { proposal_id, events };
    },
  };
}

export type AdaptationApi = ReturnType<typeof createAdaptationApi>;
