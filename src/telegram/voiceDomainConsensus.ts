/**
 * Voice Cross-Domain Coordination & Consensus Layer v7.7
 *
 * First-class entity: VoiceDomainConsensus
 *
 * This layer answers:
 *   - "How do multiple domains reach agreement on a decision?"
 *   - "What happens when domains disagree?"
 *   - "Who has final authority when there's a conflict?"
 *
 * This layer does NOT:
 *   - define domain boundaries (delegated to V7.6)
 *   - orchestrate global coherence (delegated to V7.8)
 *   - manage long-running missions (delegated to V7.9+)
 *
 * RULE: SAFETY DOMAIN HAS FINAL AUTHORITY
 */

import type { VoiceDomain, VoiceDomainType } from "./voiceDomainSegmentation.js";

// ============================================================================
// Domain model
// ============================================================================

export type VoiceDomainConsensusResolution =
  | "majority_vote"
  | "priority_domain"
  | "safety_override"
  | "require_human";

export interface VoiceDomainConsensus {
  consensusId: string;

  involvedDomains: string[]; // domain IDs

  proposals: Array<{
    domainId: string;
    domainType: VoiceDomainType;
    decision: string;
    confidence: number; // 0..100
    reasoning?: string;
  }>;

  resolution: VoiceDomainConsensusResolution;

  finalDecision: string;

  resolvedAt: number;

  // Metadata
  topic: string;
  vetoedBy?: string; // domain ID that vetoed (if safety_override)
  humanReviewRequired?: boolean;
}

export type VoiceDomainConsensusValidationError =
  | "no_proposals"
  | "proposal_confidence_out_of_range"
  | "no_involved_domains"
  | "duplicate_domain_proposals"
  | "missing_domain_in_registry";

// ============================================================================
// ID generation
// ============================================================================

function generateConsensusId(): string {
  const timestamp = Date.now();
  const random = cryptoRandomHex(3);
  return `voice_consensus_${timestamp}_${random}`;
}

function cryptoRandomHex(bytes: number): string {
  try {
    const { randomBytes } = require("node:crypto");
    return randomBytes(bytes).toString("hex");
  } catch {
    return Math.random().toString(16).slice(2, 2 + bytes * 2);
  }
}

// ============================================================================
// Validation
// ============================================================================

export function validateConsensusProposals(
  proposals: VoiceDomainConsensus["proposals"],
  involvedDomains: string[],
): VoiceDomainConsensusValidationError[] {
  const errors: VoiceDomainConsensusValidationError[] = [];

  if (proposals.length === 0) {
    errors.push("no_proposals");
  }

  if (involvedDomains.length === 0) {
    errors.push("no_involved_domains");
  }

  for (const proposal of proposals) {
    if (proposal.confidence < 0 || proposal.confidence > 100) {
      errors.push("proposal_confidence_out_of_range");
      break;
    }
  }

  // Check for duplicate domain proposals
  const domainIds = proposals.map((p) => p.domainId);
  const uniqueDomainIds = new Set(domainIds);
  if (domainIds.length !== uniqueDomainIds.size) {
    errors.push("duplicate_domain_proposals");
  }

  return errors;
}

// ============================================================================
// Consensus resolution logic
// ============================================================================

export interface VoiceConsensusInput {
  topic: string;
  proposals: VoiceDomainConsensus["proposals"];
  domainRegistry: Map<string, VoiceDomain>;
}

export interface VoiceConsensusResult {
  consensus: VoiceDomainConsensus;
  resolution: VoiceDomainConsensusResolution;
  explanation: string;
}

/**
 * Resolve consensus between multiple domains.
 * Pure function — deterministic given the same proposals.
 *
 * Resolution priority:
 *   1. Safety override (safety domain vetoes)
 *   2. Require human (critical disagreement)
 *   3. Priority domain (highest-priority domain wins)
 *   4. Majority vote (default)
 */
export function resolveVoiceDomainConsensus(
  input: VoiceConsensusInput,
): VoiceConsensusResult {
  const validationErrors = validateConsensusProposals(
    input.proposals,
    input.proposals.map((p) => p.domainId),
  );

  if (validationErrors.length > 0) {
    // Cannot resolve — return human review required
    const consensus: VoiceDomainConsensus = {
      consensusId: generateConsensusId(),
      involvedDomains: input.proposals.map((p) => p.domainId),
      proposals: input.proposals,
      resolution: "require_human",
      finalDecision: `Consensus blocked: ${validationErrors.join(", ")}`,
      resolvedAt: Date.now(),
      topic: input.topic,
      humanReviewRequired: true,
    };

    return {
      consensus,
      resolution: "require_human",
      explanation: `Validation errors prevent consensus: ${validationErrors.join(", ")}`,
    };
  }

  // --- RULE 1: Safety domain override ---
  const safetyProposal = input.proposals.find(
    (p) => p.domainType === "safety",
  );
  if (safetyProposal && safetyProposal.confidence > 80) {
    const consensus: VoiceDomainConsensus = {
      consensusId: generateConsensusId(),
      involvedDomains: input.proposals.map((p) => p.domainId),
      proposals: input.proposals,
      resolution: "safety_override",
      finalDecision: safetyProposal.decision,
      resolvedAt: Date.now(),
      topic: input.topic,
      vetoedBy: safetyProposal.domainId,
    };

    return {
      consensus,
      resolution: "safety_override",
      explanation: `Safety domain (${safetyProposal.domainId}) vetoed with confidence ${safetyProposal.confidence}%: "${safetyProposal.decision}"`,
    };
  }

  // --- RULE 2: Check for critical disagreement ---
  if (hasCriticalDisagreement(input.proposals)) {
    const consensus: VoiceDomainConsensus = {
      consensusId: generateConsensusId(),
      involvedDomains: input.proposals.map((p) => p.domainId),
      proposals: input.proposals,
      resolution: "require_human",
      finalDecision: "Human review required due to critical domain disagreement",
      resolvedAt: Date.now(),
      topic: input.topic,
      humanReviewRequired: true,
    };

    return {
      consensus,
      resolution: "require_human",
      explanation: `Critical disagreement detected between ${input.proposals.length} domains`,
    };
  }

  // --- RULE 3: Priority domain resolution ---
  const priorityResult = resolveByPriorityDomain(input.proposals, input.domainRegistry, input.topic);
  if (priorityResult) {
    return priorityResult;
  }

  // --- RULE 4: Majority vote (default) ---
  return resolveByMajorityVote(input);
}

/**
 * Check if there's critical disagreement between proposals.
 * Critical = proposals differ by more than 50% confidence AND have opposite decisions.
 */
function hasCriticalDisagreement(
  proposals: VoiceDomainConsensus["proposals"],
): boolean {
  if (proposals.length < 2) return false;

  const sorted = [...proposals].sort((a, b) => b.confidence - a.confidence);
  const highest = sorted[0];
  const lowest = sorted[sorted.length - 1];

  const confidenceGap = highest.confidence - lowest.confidence;
  const decisionsDiffer = highest.decision !== lowest.decision;

  return confidenceGap > 50 && decisionsDiffer;
}

/**
 * Resolve by priority domain — safety > review > strategy > adaptation > execution.
 */
function resolveByPriorityDomain(
  proposals: VoiceDomainConsensus["proposals"],
  domainRegistry: Map<string, VoiceDomain>,
  topic: string,
): VoiceConsensusResult | null {
  const priorityOrder: VoiceDomainType[] = [
    "safety",
    "review",
    "strategy",
    "adaptation",
    "execution",
  ];

  // Find the highest-priority domain that has a proposal
  for (const priorityType of priorityOrder) {
    const priorityProposal = proposals.find(
      (p) => p.domainType === priorityType,
    );

    if (priorityProposal && priorityProposal.confidence >= 70) {
      const consensus: VoiceDomainConsensus = {
        consensusId: generateConsensusId(),
        involvedDomains: proposals.map((p) => p.domainId),
        proposals,
        resolution: "priority_domain",
        finalDecision: priorityProposal.decision,
        resolvedAt: Date.now(),
        topic,
      };

      return {
        consensus,
        resolution: "priority_domain",
        explanation: `Priority domain (${priorityType}) decided with confidence ${priorityProposal.confidence}%: "${priorityProposal.decision}"`,
      };
    }
  }

  return null;
}

/**
 * Resolve by majority vote — weighted average of confidence.
 */
function resolveByMajorityVote(
  input: VoiceConsensusInput,
): VoiceConsensusResult {
  // Group proposals by decision
  const decisionGroups = new Map<
    string,
    typeof input.proposals
  >();

  for (const proposal of input.proposals) {
    const existing = decisionGroups.get(proposal.decision) || [];
    existing.push(proposal);
    decisionGroups.set(proposal.decision, existing);
  }

  // Find the decision with highest total confidence
  let bestDecision = "";
  let bestTotalConfidence = 0;

  for (const [decision, proposals] of decisionGroups) {
    const totalConfidence = proposals.reduce(
      (sum, p) => sum + p.confidence,
      0,
    );
    if (totalConfidence > bestTotalConfidence) {
      bestDecision = decision;
      bestTotalConfidence = totalConfidence;
    }
  }

  const avgConfidence =
    bestTotalConfidence /
    (decisionGroups.get(bestDecision)?.length || 1);

  const consensus: VoiceDomainConsensus = {
    consensusId: generateConsensusId(),
    involvedDomains: input.proposals.map((p) => p.domainId),
    proposals: input.proposals,
    resolution: "majority_vote",
    finalDecision: bestDecision,
    resolvedAt: Date.now(),
    topic: input.topic,
  };

  return {
    consensus,
    resolution: "majority_vote",
    explanation: `Majority vote: "${bestDecision}" (avg confidence=${avgConfidence.toFixed(1)}%, ${decisionGroups.get(bestDecision)?.length || 0}/${input.proposals.length} domains)`,
  };
}

// ============================================================================
// Consensus history
// ============================================================================

export interface VoiceDomainConsensusHistory {
  records: VoiceDomainConsensus[];
  maxHistorySize: number;
}

const DEFAULT_CONSENSUS_MAX_HISTORY = 100;

let _consensusHistory: VoiceDomainConsensusHistory = {
  records: [],
  maxHistorySize: DEFAULT_CONSENSUS_MAX_HISTORY,
};

export function getVoiceDomainConsensusHistory(): VoiceDomainConsensusHistory {
  return { ..._consensusHistory };
}

export function recordVoiceDomainConsensus(
  consensus: VoiceDomainConsensus,
): void {
  _consensusHistory.records.push(consensus);

  if (_consensusHistory.records.length > _consensusHistory.maxHistorySize) {
    _consensusHistory.records = _consensusHistory.records.slice(
      -_consensusHistory.maxHistorySize,
    );
  }
}

export function clearVoiceDomainConsensusHistory(): void {
  _consensusHistory = {
    records: [],
    maxHistorySize: DEFAULT_CONSENSUS_MAX_HISTORY,
  };
}

export function setVoiceDomainConsensusHistoryForTest(
  history: VoiceDomainConsensusHistory,
): void {
  _consensusHistory = history;
}

// ============================================================================
// Formatter
// ============================================================================

export function formatVoiceDomainConsensus(
  consensus: VoiceDomainConsensus,
): string {
  const lines = [
    `⚖️ Voice Domain Consensus`,
    `• consensus ID: ${consensus.consensusId}`,
    `• topic: ${consensus.topic}`,
    `• resolution: ${consensus.resolution}`,
    `• decision: ${consensus.finalDecision}`,
    `• resolved at: ${new Date(consensus.resolvedAt).toISOString()}`,
    `--- Proposals (${consensus.proposals.length}) ---`,
  ];

  for (const proposal of consensus.proposals) {
    lines.push(
      `  • ${proposal.domainType} (${proposal.domainId}): "${proposal.decision}" [confidence=${proposal.confidence}%]`,
    );
    if (proposal.reasoning) {
      lines.push(`    reasoning: ${proposal.reasoning}`);
    }
  }

  if (consensus.vetoedBy) {
    lines.push(`• vetoed by: ${consensus.vetoedBy}`);
  }

  if (consensus.humanReviewRequired) {
    lines.push(`• ⚠️ HUMAN REVIEW REQUIRED`);
  }

  return lines.join("\n");
}

export function formatVoiceDomainConsensusHistory(
  history: VoiceDomainConsensusHistory,
): string {
  const lines = [
    `⚖️ Voice Domain Consensus History (${history.records.length} entries)`,
  ];

  const recent = history.records.slice(-5);
  for (const record of recent) {
    lines.push(
      `  [${record.resolution}] ${record.topic}: "${record.finalDecision}"`,
    );
  }

  return lines.join("\n");
}
