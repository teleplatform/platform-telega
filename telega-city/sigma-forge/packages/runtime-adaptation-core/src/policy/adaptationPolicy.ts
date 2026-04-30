import type { AdaptationProposal, PolicyOutcome, ProposalRiskClass } from "../../runtime-adaptation-contracts/src/adaptation.js";

export function evaluateProposalPolicy(proposal: AdaptationProposal): { outcome: PolicyOutcome; risk_class: ProposalRiskClass; reasons: string[] } {
  const reasons: string[] = [];

  // Forbidden changes always blocked
  if (proposal.risk_class === "forbidden") {
    return { outcome: "forbidden", risk_class: "forbidden", reasons: ["forbidden_change_type"] };
  }

  // High risk always requires review
  if (proposal.risk_class === "high") {
    reasons.push("high_risk_requires_review");
    return { outcome: "review_required", risk_class: "high", reasons };
  }

  // Medium risk requires review unless auto-apply policy allows
  if (proposal.risk_class === "medium") {
    reasons.push("medium_risk_review_recommended");
    return { outcome: "review_required", risk_class: "medium", reasons };
  }

  // Low risk can auto-apply
  if (proposal.risk_class === "low") {
    reasons.push("low_risk_auto_apply_allowed");
    return { outcome: "auto_apply_allowed", risk_class: "low", reasons };
  }

  return { outcome: "review_required", risk_class: "medium", reasons: ["default_review_required"] };
}
